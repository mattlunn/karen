import express from 'express';
import asyncWrapper from "../helpers/express-async-wrapper";
import config from '../config';
import { saveConfig } from '../helpers/config';
import { stringify } from 'querystring';
import sleep from '../helpers/sleep';
import logger from '../logger';

/**
 * 
 * 
 * https://support.tado.com/en/articles/8565472-how-do-i-authenticate-to-access-the-rest-api
 * 
 * 
 */

const router = express.Router();

async function initiateAuthFlow() {
  const response = await fetch('https://login.tado.com/oauth2/device_authorize', {
    method: 'POST',
    body: stringify({
      client_id: '1bb50063-6b0c-4d11-bd99-387f4a91cc46',
      scope: 'offline_access'
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (!response.ok) {
    logger.warn(await response.json());

    throw new Error(`Got ${response.status} while initiating auth flow`);
  }

  return await response.json();
}

async function tryGetRefreshToken(deviceCode: string) {
  const response = await fetch('https://login.tado.com/oauth2/token', {
    method: 'POST',
    body: stringify({
      client_id: '1bb50063-6b0c-4d11-bd99-387f4a91cc46',
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (!response.ok) {
    throw new Error(`Got ${response.status} trying to exchange refresh token`);
  }

  return (await response.json()).refresh_token;
}

router.use((req, res, next) => {
  if (req.query.secret !== config.tado.secret) {
    return res.sendStatus(401).end();
  } else {
    next();
  }
});

router.get('/auth', asyncWrapper(async (req, res) => {
  const initialData = await initiateAuthFlow();
  const interval = Math.max(initialData.interval, 5);

  res.redirect(initialData.verification_uri_complete);

  for (let i=interval; i<=60; i+=interval) {
    logger.info('Trying to exchange device code for refresh_token');

    try {
      const token = await tryGetRefreshToken(initialData.device_code);

      config.tado.refresh_token = token;
      saveConfig();

      return logger.info('Successfully exchanged device code for refresh_token');
    } catch (e) {
      logger.warn(`Got an error exchanging device code for refresh_token; will retry in ${interval} seconds`);

      await sleep(interval * 1000);
    }
  };

  logger.error(`Failed to exchange adevice code for refresh_token.`);
}));

export default router;