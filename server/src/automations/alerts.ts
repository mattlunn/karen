import bus, { EVENT_START, NOTIFICATION_TO_ADMINS } from '../bus';
import { createBackgroundTransaction } from '../helpers/newrelic';

export default function () {
  bus.on(EVENT_START, createBackgroundTransaction(`automations:alerts`, async (event) => {
    if (event.type === 'system_pressure' && event.value < 5) {
      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: `🚨 Heating system pressure has fallen below 1 bar to ${event.value}.`
      });
    }
  }));
}
