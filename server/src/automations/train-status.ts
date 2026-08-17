import bus, { NOTIFICATION_TO_USER } from '../bus';
import dayjs from '../dayjs';
import logger from '../logger';
import setIntervalForTime from '../helpers/set-interval-for-time';
import { getServiceStatus, ServiceStatus } from '../services/raildata/client';

type TrainAlert = {
  user: string;
  day: string;
  departureTime: string;
  from: string;
  to: string;
};

export type TrainStatusAutomationParameters = {
  startCheckingAt: number;
  checkInterval: number;
  alerts: TrainAlert[];
};

const DAY_NAMES = new Set([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
]);

const TRAFFIC_LIGHT: Record<ServiceStatus['kind'], string> = {
  'on-time': '🟢',
  'delayed': '🟠',
  'cancelled': '🔴',
  'not-found': '🔴',
};

function formatMessage(status: ServiceStatus, from: string, to: string): string {
  const light = TRAFFIC_LIGHT[status.kind];
  const platform = 'platform' in status && status.platform !== null
    ? ` (Plat ${status.platform})`
    : '';

  switch (status.kind) {
    case 'on-time':
      return `🚆 ${light} ${status.scheduled} ${from} → ${to} is on time${platform}`;
    case 'delayed':
      return `🚆 ${light} ${status.scheduled} ${from} → ${to} delayed, now ${status.estimated}${platform}`;
    case 'cancelled':
      return `🚆 ${light} ${status.scheduled} ${from} → ${to} CANCELLED${status.reason ? ` — ${status.reason}` : ''}`;
    case 'not-found':
      return `🚆 ${light} ${status.scheduled} ${from} → ${to} not found on the departure board`;
  }
}

function runAlert(alert: TrainAlert, checkInterval: number) {
  if (dayjs().format('dddd').toLowerCase() !== alert.day.toLowerCase()) {
    return;
  }

  const [depHour, depMinute] = alert.departureTime.split(':').map(Number);
  const departure = dayjs().startOf('minute').hour(depHour).minute(depMinute);
  let lastSentMessage: string | null = null;

  async function runCheck(alwaysSend: boolean) {
    try {
      const status = await getServiceStatus(alert.from, alert.to, alert.departureTime);
      const message = formatMessage(status, alert.from, alert.to);

      if (alwaysSend || message !== lastSentMessage) {
        bus.emit(NOTIFICATION_TO_USER, { userHandle: alert.user, message });
        lastSentMessage = message;
      }
    } catch (e) {
      logger.error(e, `train-status: check failed for ${alert.user}`);
    }
  }

  function scheduleNext() {
    const nextCheck = dayjs().add(checkInterval, 'minute');

    if (nextCheck.isAfter(departure)) {
      return;
    }

    setTimeout(async () => {
      await runCheck(false);
      scheduleNext();
    }, checkInterval * 60 * 1000);
  }

  runCheck(true).then(scheduleNext);
}

export default function ({ startCheckingAt, checkInterval, alerts }: TrainStatusAutomationParameters) {
  for (const alert of alerts) {
    if (!DAY_NAMES.has(alert.day.toLowerCase())) {
      throw new Error(`train-status: invalid day "${alert.day}"`);
    }

    setIntervalForTime(() => {
      runAlert(alert, checkInterval);
    }, `${alert.departureTime} - ${startCheckingAt}m`);
  }
}
