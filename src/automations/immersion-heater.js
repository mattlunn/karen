import scheduleWithinTimeWhileOccupied from '../helpers/schedule-within-time-while-occupied';
import { Device } from '../models';

export default function ({ timings = [], heaterName }) {
  for (const { start, end } of timings) {
    scheduleWithinTimeWhileOccupied(start, end, async () => {
      const device = await Device.findByName(heaterName);

      await device.setProperty('on', true);
    }, async () => {
      const device = await Device.findByName(heaterName);

      await device.setProperty('on', false);
    });
  }
}