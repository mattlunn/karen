import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { User, Stay } from '../../models';
import { HOME, AWAY } from '../../constants/status';
import dayjs from '../../dayjs';
import { UsersApiResponse, UserUpdateRequest, UserResponse } from '../../api/types';

const router = express.Router();

router.get<Record<string, never>, UsersApiResponse>('/', asyncWrapper(async (_req, res) => {
  const users = await User.findAll();
  const userIds = users.map(u => u.id);

  const [currentOrLastStays, upcomingStays] = await Promise.all([
    Stay.findCurrentOrLastStays(userIds),
    Stay.findUpcomingStays(userIds)
  ]);

  const currentStaysByUserId = new Map<number, Stay>(currentOrLastStays.map(stay => [stay.userId as number, stay]));
  const upcomingStaysByUserId = new Map<number, Stay>(upcomingStays.map(stay => [stay.userId as number, stay]));

  const usersResponse: UsersApiResponse = users.map(user => {
    const currentOrLast = currentStaysByUserId.get(user.id);
    const upcoming = upcomingStaysByUserId.get(user.id);
    const isAway = !currentOrLast || currentOrLast.departure !== null;

    if (isAway) {
      return {
        id: user.handle,
        avatar: user.avatar,
        status: 'AWAY' as const,
        since: null,
        until: upcoming?.eta ? +upcoming.eta : null
      };
    } else {
      return {
        id: user.handle,
        avatar: user.avatar,
        status: 'HOME' as const,
        since: +currentOrLast.arrival!,
        until: null
      };
    }
  });

  res.json(usersResponse);
}));

router.put<{ id: string }, UserResponse, UserUpdateRequest>('/:id', asyncWrapper(async (req, res) => {
  const user = await User.findOne({
    where: { handle: req.params.id }
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const body = req.body;
  const [[currentStay], [upcomingStay]] = await Promise.all([
    Stay.findCurrentOrLastStays([user.id]),
    Stay.findUpcomingStays([user.id])
  ]);
  
  let upcoming: Stay | null = upcomingStay ?? null;
  let current = currentStay ?? null;

  if (body.status) {
    switch (body.status) {
      case HOME:
        if (!current || current.departure !== null) {
          if (!upcoming) {
            upcoming = new Stay();
            upcoming.userId = user.id;
          }

          upcoming.arrivalTrigger = 'manual';
          upcoming.arrival = new Date();

          current = upcoming;
          upcoming = null;

          await current.save();
        }
        break;

      case AWAY:
        if (current && current.departure === null) {
          current.departure = new Date();
          await current.save();
        }
        break;
    }
  }

  if (body.eta) {
    const eta = dayjs(body.eta);

    if (current && current.departure === null) {
      res.status(400).json({ error: `${user.handle} is currently at home. User must be away to set an ETA` });
      return;
    }

    if (eta.isBefore(dayjs())) {
      res.status(400).json({ error: `ETA cannot be before the current time` });
      return;
    }

    if (!upcoming) {
      upcoming = new Stay();
      upcoming.userId = user.id;
    }

    upcoming.eta = eta.toDate();
    await upcoming.save();
  }

  const isAway = !current || !!current.departure;
  res.json({
    id: user.handle,
    avatar: user.avatar,
    status: isAway ? 'AWAY' : 'HOME',
    since: isAway ? null : current?.arrival,
    until: upcoming?.eta ?? null
  });
}));

export default router;
