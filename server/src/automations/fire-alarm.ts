import { z } from 'zod';
import { BooleanEvent, Device, Log, User } from '../models';
import dayjs from '../dayjs';
import logger from '../logger';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { joinWithAnd } from '../helpers/array';

export const parameters = z.object({
  deviceName: z.string()
});

async function describeWhoIsHome(): Promise<string> {
  const handles = (await User.getUsersAtHome()).map(u => u.handle);

  if (handles.length === 0) {
    return 'nobody is home';
  }

  return `${joinWithAnd(handles)} ${handles.length === 1 ? 'is' : 'are'} home`;
}

export default function ({ deviceName }: z.infer<typeof parameters>) {
  const isThisDevice = (d: Device) => d.name === deviceName;

  DeviceCapabilityEvents.onAlarmSensorIsTriggeredStart(isThisDevice, createBackgroundTransaction('automations:fire-alarm:triggered', async (event: BooleanEvent) => {
    const time = dayjs(event.start).format('HH:mm');
    const homeList = await describeWhoIsHome();
    const message = `Fire alarm activated at ${time}. ${homeList}.`;

    logger.warn({ event: 'fire-alarm-triggered' }, message);

    await Log.notify({ severity: 'critical', audience: 'all', devices: [await event.getDevice()], message });
  }));

  DeviceCapabilityEvents.onConnectivityIsConnectedEnd(isThisDevice, createBackgroundTransaction('automations:fire-alarm:offline', async (event: BooleanEvent) => {
    const message = `Fire alarm has gone offline as of ${dayjs(event.start).format('HH:mm')}.`;

    logger.warn({ event: 'fire-alarm-offline' }, message);
    await Log.notify({ severity: 'warning', audience: 'all', devices: [await event.getDevice()], message });
  }));

  DeviceCapabilityEvents.onConnectivityIsConnectedStart(isThisDevice, createBackgroundTransaction('automations:fire-alarm:online', async (event: BooleanEvent) => {
    const message = `Fire alarm is back online as of ${dayjs(event.start).format('HH:mm')}.`;

    logger.info({ event: 'fire-alarm-online' }, message);
    await Log.notify({ severity: 'notice', audience: 'all', devices: [await event.getDevice()], message });
  }));
}
