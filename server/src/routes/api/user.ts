import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { User, Stay } from '../../models';
import { HOME, AWAY } from '../../constants/status';
import dayjs from '../../dayjs';

const router = express.Router();

type UserStatus = 'HOME' | 'AWAY';

interface UserUpdateRequest {
  status?: UserStatus;
  eta?: number;
}

interface UserResponse {
  id: string;
  avatar: string;
  status: UserStatus;
  since: number;
  until: number | null;
}

router.put('/:id', asyncWrapper(async (req, res) => {
  const user = await User.findOne({
    where: { handle: req.params.id }
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const body = req.body as UserUpdateRequest;

  const [[currentStay], [upcomingStay]] = await Promise.all([
    Stay.findCurrentOrLastStays([user.id]),
    Stay.findUpcomingStays([user.id])
  ]);

  let current: Stay | null = currentStay ?? null;
  let upcoming: Stay | null = upcomingStay ?? null;

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

  const isAway = upcoming || current?.departure;
  const status: UserStatus = isAway ? 'AWAY' : 'HOME';

  const since = isAway
    ? (current?.departure ? +current.departure : 0)
    : (current?.arrival ? +current.arrival : 0);

  const until = isAway && upcoming?.eta ? +upcoming.eta : null;

  const response: UserResponse = {
    id: user.handle,
    avatar: user.avatar,
    status,
    since,
    until
  };

  res.json(response);
}));

export default router;
