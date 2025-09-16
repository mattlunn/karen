import bus, { NOTIFICATION_TO_ADMINS } from '../bus';
import { DeviceCapabilityEvents } from '../models/capabilities';

export default function () {
  DeviceCapabilityEvents.onHeatPumpSystemPressureChanged((event) => {
    if (event.value < 1) {
      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: `🚨 Heating system pressure has fallen below 1 bar to ${event.value}.`
      });
    }
  });
}
