import { UnifiClient } from './lib';
import config from '../../config';
import { User, Stay } from '../../models';
import { markUserAsAway, markUserAsHome } from '../../helpers/presence';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import logger from '../../logger';

const TEN_MINUTES_IN_MS = 1000 * 60 * 10;

const client = new UnifiClient(
  config.unifi.host,
  config.unifi.port,
  config.unifi.username,
  config.unifi.password,
);

client.login().catch((e: unknown) => logger.error({ err: e }, 'Initial UniFi login failed'));

nowAndSetInterval(createBackgroundTransaction('unifi:check-presence', async () => {
  const [
    users,
    unifiUsers,
    unifiDevices,
  ] = await Promise.all([
    User.findAll(),
    client.getAllUsers(),
    client.getClientDevices(),
  ]);

  for (const user of users) {
    if (user.device) {
      const unifiDevice = unifiDevices.find((unifiDevice) => unifiDevice.name === user.device);
      const unifiUser = unifiUsers.find((unifiUser) => unifiUser.name === user.device);
      const [ stay ] = await Stay.findCurrentOrLastStays([user.id]);
      const userHasRecentlyLeft = !!stay.departure && Date.now() - stay.departure.getTime() < TEN_MINUTES_IN_MS;
      const userHasRecentlyArrived = !userHasRecentlyLeft && Date.now() - stay.arrival!.getTime() < TEN_MINUTES_IN_MS;

      if (unifiUser) {
        if (!userHasRecentlyLeft && !userHasRecentlyArrived) {
          const deviceIsHome = unifiDevice || Date.now() - (config.unifi.device_considered_gone_after_in_seconds * 1000) < (unifiUser.last_seen * 1000);
          const userIsHome = stay && stay.departure === null;

          if (deviceIsHome && !userIsHome) {
            logger.info(`Forcing ${user.handle} to home, as their device is at home`);

            await markUserAsHome(user, 'wifi');
          } else if (!deviceIsHome && userIsHome) {
            logger.info(`Forcing ${user.handle} to away, as their device has not been seen recently`);

            await markUserAsAway(user);
          }
        }
      } else {
        throw new Error(user.device + ' not found');
      }
    }
  }
}), config.unifi.device_check_interval_in_seconds * 1000);
