import { BooleanEvent } from '../models';
import bus, { NOTIFICATION_TO_ALL } from '../bus';
import dayjs from '../dayjs';
import logger from '../logger';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { DeviceCapabilityEvents } from '../models/capabilities';

export default function () {
  DeviceCapabilityEvents.onLockIsJammed(createBackgroundTransaction('automations:lock-jam', async (event: BooleanEvent) => {
    const device = await event.getDevice();
    const message = `${device.name} is jammed (as of ${dayjs(event.start).format('HH:mm')}).`;

    logger.warn({ event: 'lock-jammed' }, message);
    bus.emit(NOTIFICATION_TO_ALL, { message });
  }));
}
