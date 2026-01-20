import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { User, Stay } from '../../models';
import { HOME, AWAY } from '../../constants/status';
import dayjs from '../../dayjs';
import { UserUpdateRequest, UserResponse } from '../../api/types';

const router = express.Router();

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

  let current = currentStay ?? null;
  let upcoming = upcomingStay ?? null;

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
