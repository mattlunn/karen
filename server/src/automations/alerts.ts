import bus, { EVENT_START, NOTIFICATION_TO_ADMINS } from '../bus';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { Device } from '../models';
import { MODES } from '../services/ebusd/client';

export default function () {
  bus.on(EVENT_START, createBackgroundTransaction(`automations:alerts`, async (event) => {
    if (event.type === 'system_pressure' && event.value < 1) {
      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: `🚨 Heating system pressure has fallen below 1 bar to ${event.value}.`
      });
    }

    if (event.type === 'mode') {
      const thermostats = await Device.findByType('thermostat');
      const downstairsThermostats = thermostats.filter(x => !x.name.includes('Bedroom') && !x.name.includes('Landing'));
      const downstairsThermostatsPowerDemand = await Promise.all(downstairsThermostats.map(x => x.getThermostatCapability().getPower()));

      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: [
          `Heat pump mode has changed to ${Object.entries(MODES).find(([_, value]) => value === event.value)?.[0] ?? 'unknown'}`,
          `Power demand is ${downstairsThermostats.map((x, idx) => `${x.name}: ${downstairsThermostatsPowerDemand[idx]}%`).join(', ')}`
        ].join('. ')
      });
    }
  }));
}
