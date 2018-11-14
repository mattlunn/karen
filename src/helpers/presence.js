import { Stay } from '../models';
import config from '../config';
import moment from 'moment';

export async function markUserAsHome(user) {
  let [current, upcoming] = await Promise.all([
    Stay.findCurrentStay(user.id),
    Stay.findUpcomingStay(user.id)
  ]);

  if (current) {
    throw new Error(`Cannot mark ${user.handle} as home when they are already home!`);
  } else {
    if (!upcoming) {
      upcoming = new Stay({
        userId: user.id
      });
    }

    upcoming.arrival = new Date();
    await upcoming.save();
  }
}

export async function markUserAsAway(user) {
  const userId = user.id;
  let [ current, unclaimedEta ] = await Promise.all([
    Stay.findCurrentStay(userId),
    Stay.findUnclaimedEta(moment().subtract(config.location.unclaimed_eta_search_window_in_minutes, 'minutes'))
  ]);

  if (!current) {
    throw new Error(`Cannot mark ${user.handle} as away when they're already away!`);
  } else {
    current.departure = new Date();

    await current.save();

    if (unclaimedEta) {
      console.log(`${res.locals.user.handle} claims ETA ${unclaimedEta.id}`);

      unclaimedEta.userId = userId;

      await unclaimedEta.save();
    } else if (current.eta !== null && moment(current.eta).isAfter(current.departure)) {
      console.log(`Exit for ${res.locals.user.handle} in stay ${current.id}`
       + ` is before the ETA, and there is no upcoming unclaimed ETA. Assuming `
       + ` user went near to home, without actually going in...`);

      unclaimedEta = new Stay();
      unclaimedEta.userId = userId;
      unclaimedEta.eta = current.eta;

      await unclaimedEta.save();
    }
  }
}