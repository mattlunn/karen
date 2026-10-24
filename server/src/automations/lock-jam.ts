import { z } from 'zod';
import { BooleanEvent, Log } from '../models';
import dayjs from '../dayjs';
import logger from '../logger';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { DeviceCapabilityEvents } from '../models/capabilities';

export const parameters = z.strictObject({}).nullish();

export default function () {
  DeviceCapabilityEvents.onLockIsJammed(createBackgroundTransaction('automations:lock-jam', async (event: BooleanEvent) => {
    const device = await event.getDevice();
    const message = `${device.name} is jammed (as of ${dayjs(event.start).format('HH:mm')}).`;

    logger.warn({ event: 'lock-jammed' }, message);
    await Log.notify({ severity: 'notice', audience: 'all', devices: [device], message });
  }));
}
