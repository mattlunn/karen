import bus, { EVENT_START, EVENT_END, LAST_USER_LEAVES, FIRST_USER_HOME } from '../bus';
import { Arming, Stay } from '../models';

export default function ({ ...rest }) {
  [LAST_USER_LEAVES, FIRST_USER_HOME].forEach((eventEvent) => {
    bus.on(eventEvent, async () => {
      const now = new Date();
      const arming = await Arming.getActiveArming(now);

      if (arming === null && eventEvent === LAST_USER_LEAVES) {
        await Arming.create({
          start: now
        });
      } else if (arming !== null && eventEvent === FIRST_USER_HOME) {
        arming.end = now;

        await arming.save();
      }
    });
  });

  bus.on(EVENT_START, async (event) => {
    if (event.type === 'motion') {
      const [
        arming,
        isSomeoneAtHome
      ] = await Promise.all([
        Arming.getActiveArming(event.start),
        Stay.checkIfSomeoneHomeAt(event.start)
      ]);

      if (arming) {

      }
    }
  });
}