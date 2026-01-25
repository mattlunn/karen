import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { User, Stay } from '../../models';
import { UsersApiResponse } from '../../api/types';

const router = express.Router();

router.get<Record<string, never>, UsersApiResponse>('/', asyncWrapper(async (_req, res) => {
  const users = await User.findAll();
  const userIds = users.map(u => u.id);

  const [currentOrLastStays, upcomingStays] = await Promise.all([
    Stay.findCurrentOrLastStays(userIds),
    Stay.findUpcomingStays(userIds)
  ]);

  const currentStaysByUserId = new Map<number, Stay>();
  for (const stay of currentOrLastStays) {
    if (stay && stay.userId !== null) {
      currentStaysByUserId.set(stay.userId as number, stay);
    }
  }

  const upcomingStaysByUserId = new Map<number, Stay>();
  for (const stay of upcomingStays) {
    if (stay && stay.userId !== null) {
      upcomingStaysByUserId.set(stay.userId as number, stay);
    }
  }

  const usersResponse: UsersApiResponse = users.map(user => {
    const currentOrLast = currentStaysByUserId.get(user.id);
    const upcoming = upcomingStaysByUserId.get(user.id);

    const isAway = upcoming || currentOrLast?.departure;

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
        since: currentOrLast?.arrival ? +currentOrLast.arrival : 0,
        until: null
      };
    }
  });

  res.json(usersResponse);
}));

export default router;
