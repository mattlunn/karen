import { Router } from 'express';
import { Token, User, Device, Stay } from '../models';
import { markUserAsHome, markUserAsAway } from '../helpers/presence';
import bus, { NOTIFICATION_TO_ADMINS } from '../bus';
import asyncWrapper from '../helpers/express-async-wrapper';
import config from '../config';
import dayjs from '../dayjs';
import logger from '../logger';
import { readFileSync } from 'fs';
import { join } from 'path';

const router = Router();

const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = failedAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = failedAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    failedAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}

async function getGuestFromCookie(req: { cookies: Record<string, string> }): Promise<User | null> {
  const tokenValue = req.cookies['OAuth.AccessToken'];

  if (!tokenValue) {
    return null;
  }

  const record = await Token.findValidWithUser(tokenValue);

  if (!record || record.user.role !== 'guest') {
    return null;
  }

  return record.user;
}

const template = readFileSync(join(__dirname, '../views/guest.html'), 'utf-8');

function renderPage(data: { authenticated: false } | { authenticated: true; name: string; isHome: boolean }) {
  return template.replace('__STATE__', JSON.stringify(data));
}

router.get('/', asyncWrapper(async (req, res) => {
  const guest = await getGuestFromCookie(req);

  if (guest && guest.isGuestCodeCurrentlyValid()) {
    const currentStay = await Stay.findCurrentStay(guest.id);

    res.send(renderPage({
      authenticated: true,
      name: guest.handle,
      isHome: !!currentStay
    }));
  } else {
    res.send(renderPage({ authenticated: false }));
  }
}));

router.post('/verify', asyncWrapper(async (req, res) => {
  const ip = req.ip || 'unknown';

  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    return;
  }

  const { code } = req.body;

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Please enter a valid 6-digit code.' });
    return;
  }

  const guest = await User.findByCode(code);

  if (!guest || !guest.isGuestCodeCurrentlyValid()) {
    recordFailedAttempt(ip);

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `Failed guest access attempt with code ${code}`
    });

    res.status(401).json({ error: 'Invalid or expired code.' });
    return;
  }

  const token = await Token.createForUser(guest);
  const expiry = dayjs().add(1, 'y').toDate();

  res.cookie('OAuth.AccessToken', token, {
    expires: expiry,
    httpOnly: false,
    sameSite: true
  });

  const currentStay = await Stay.findCurrentStay(guest.id);

  res.json({
    name: guest.handle,
    isHome: !!currentStay
  });
}));

router.post('/toggle', asyncWrapper(async (req, res) => {
  const guest = await getGuestFromCookie(req);

  if (!guest || !guest.isGuestCodeCurrentlyValid()) {
    res.status(401).json({ error: 'Session expired or code no longer valid.' });
    return;
  }

  const currentStay = await Stay.findCurrentStay(guest.id);
  const isHome = !!currentStay;

  if (isHome) {
    await markUserAsAway(guest);

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `${guest.handle} (guest) has marked themselves as away`
    });

    res.json({ isHome: false });
  } else {
    await markUserAsHome(guest, 'nfc');

    try {
      const device = await Device.findByName(config.guest_access.doorLockName);

      if (device) {
        await device.getLockCapability().setIsLocked(false);
      } else {
        logger.error(`Guest access: door lock device "${config.guest_access.doorLockName}" not found`);
      }
    } catch (e) {
      logger.error('Guest access: failed to unlock door', e);
    }

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `${guest.handle} (guest) has arrived and the front door has been unlocked`
    });

    res.json({ isHome: true });
  }
}));

export default router;
