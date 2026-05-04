import { Stay, User, BooleanEvent } from '../models';
import { call } from '../services/twilio';
import bus, { NOTIFICATION_TO_ALL } from '../bus';
import dayjs from '../dayjs';
import logger from '../logger';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { DeviceCapabilityEvents } from '../models/capabilities';

type FireAlarmAutomationParameters = {
  device_name: string;
};

function joinHomeUsers(handles: string[]): string {
  if (handles.length === 0) {
    return 'nobody is home';
  }

  if (handles.length === 1) {
    return `${handles[0]} is home`;
  }

  if (handles.length === 2) {
    return `${handles[0]} and ${handles[1]} are home`;
  }

  const last = handles[handles.length - 1];
  const rest = handles.slice(0, -1).join(', ');

  return `${rest}, and ${last} are home`;
}

async function getHomeUserHandles(): Promise<string[]> {
  const [currentStays, allUsers] = await Promise.all([
    Stay.findCurrentStays(),
    User.findAll()
  ]);

  const homeUserIds = new Set(currentStays.map(stay => stay.userId));

  return allUsers
    .filter(user => homeUserIds.has(user.id))
    .map(user => user.handle);
}

export default function ({ device_name: deviceName }: FireAlarmAutomationParameters) {
  DeviceCapabilityEvents.onContactSensorIsClosedStart(createBackgroundTransaction('automations:fire-alarm:triggered', async (event: BooleanEvent) => {
    const device = await event.getDevice();

    if (device.name !== deviceName) {
      return;
    }

    const time = dayjs(event.start).format('HH:mm');
    const homeList = joinHomeUsers(await getHomeUserHandles());
    const message = `Fire alarm activated at ${time}. ${homeList}.`;

    logger.warn({ deviceId: device.id, deviceName: device.name }, message);

    bus.emit(NOTIFICATION_TO_ALL, {
      message,
      priority: 2
    });

    const allUsers = await User.findAll();

    for (const user of allUsers) {
      if (!user.mobileNumber) {
        continue;
      }

      call(
        user,
        `<Response><Say voice="woman">Hi ${user.handle}. This is Karen. ${message}. I repeat. ${message}. Goodbye.</Say></Response>`
      );
    }
  }));
}
