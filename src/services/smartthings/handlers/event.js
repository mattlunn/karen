import { Event } from '../../../models';

export default async function ({ eventData }) {
  for (const event of eventData.events) {
    const isOn = Number(event.deviceEvent.value === 'active');
    const lastMotionEvent = await Event.findOne({
      where: {
        deviceType: 'motion_sensor',
        deviceId: event.deviceEvent.deviceId,
        type: 'motion'
      },

      order: [['start', 'DESC']]
    });

    if (isOn) {
      if (lastMotionEvent !== null && lastMotionEvent.end === null) {
        throw new Error(`Device has detected motion, but last motion event does not have an 'end' set`);
      }

      await Event.create({
        deviceType: 'motion_sensor',
        deviceId: event.deviceEvent.deviceId,
        type: 'motion',
        value: 1,
        start: Date.now()
      });
    } else {
      if (lastMotionEvent.end !== null) {
        throw new Error(`Device has detected no more motion, but there is no 'open' motion event`);
      }

      lastMotionEvent.end = Date.now();
      await lastMotionEvent.save();
    }
  }

  return {
    success: true
  };
}