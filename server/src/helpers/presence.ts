import { Stay, User } from '../models';
import config from '../config';
import dayjs from '../dayjs';
import logger from '../logger';
import { enqueueWorkItem } from '../queue';

export async function markUserAsHome(user: User, trigger: 'wifi' | 'geolocation') {
  await enqueueWorkItem(async () => {
    const [current, [existingUpcoming]] = await Promise.all([
      Stay.findCurrentStay(user.id),
      Stay.findUpcomingStays([user.id])
    ]);

    if (current) {
      throw new Error(`Cannot mark ${user.handle} as home when they are already home!`);
    } else {
      const upcoming = existingUpcoming ?? new Stay({
        userId: user.id
      });

      upcoming.arrivalTrigger = trigger;
      upcoming.arrival = new Date();
      await upcoming.save();
    }
  });
}

export async function markUserAsAway(user: User) {
  await enqueueWorkItem(async () => {
    const userId = user.id;
    const [ current, existingUnclaimedEta ] = await Promise.all([
      Stay.findCurrentStay(userId),
      Stay.findUnclaimedEta(dayjs().subtract(config.location.unclaimed_eta_search_window_in_minutes, 'minutes').toDate())
    ]);

    if (!current) {
      throw new Error(`Cannot mark ${user.handle} as away when they're already away!`);
    } else {
      current.departure = new Date();

      await current.save();

      if (existingUnclaimedEta) {
        logger.info(`${user.handle} claims ETA ${existingUnclaimedEta.id}`);

        existingUnclaimedEta.userId = userId;

        await existingUnclaimedEta.save();
      } else if (current.eta !== null && dayjs(current.eta).isAfter(current.departure)) {
        logger.info(`Exit for ${user.handle} in stay ${current.id}`
        + ` is before the ETA, and there is no upcoming unclaimed ETA. Assuming `
        + ` user went near to home, without actually going in...`);

        const unclaimedEta = new Stay();
        unclaimedEta.userId = userId;
        unclaimedEta.eta = current.eta;

        await unclaimedEta.save();
      }
    }
  });
}