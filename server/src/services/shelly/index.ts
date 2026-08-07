import { Device } from '../../models';
import { publishCommand } from './mqtt';

const TOPIC_PREFIX = 'shellies';

Device.registerProvider('shelly', {
  getCapabilities(device) {
    switch (device.model) {
      case 'SHDM-2':       // Shelly Dimmer 2
        return ['LIGHT', 'ENERGY_MONITOR', 'CONNECTIVITY'];

      case 'SNPL-00112UK': // Shelly Plus Plug UK
        return ['SWITCH', 'ENERGY_MONITOR', 'CONNECTIVITY'];

      case 'S3SW-001X8EU': // Shelly Plus 1 Mini (Heating)
        return ['SWITCH', 'CONNECTIVITY'];

      case 'S4SW-001X8EU': // Shelly 1 Mini Gen4 (Fire Alarm)
        return ['ALARM_SENSOR', 'CONNECTIVITY'];

      case 'SBDW-002C':    // Shelly BLU Door/Window (via BLE gateway)
        return ['CONTACT_SENSOR'];

      default:
        throw new Error(`Cannot infer capabilities for device ${device.id} (${device.model})`);
    }
  },

  provideLightCapability() {
    return {
      setBrightness(device: Device, brightness: number) {
        return publishCommand(
          `${TOPIC_PREFIX}/${device.providerId}/light/0/set`,
          JSON.stringify({ turn: brightness > 0 ? 'on' : 'off', brightness })
        );
      },

      setIsOn(device: Device, isOn: boolean) {
        return publishCommand(
          `${TOPIC_PREFIX}/${device.providerId}/light/0/command`,
          isOn ? 'on' : 'off'
        );
      },
    };
  },

  provideSwitchCapability() {
    return {
      setIsOn(device: Device, isOn: boolean) {
        return publishCommand(
          `${TOPIC_PREFIX}/${device.providerId}/command/switch:0`,
          isOn ? 'on' : 'off'
        );
      },
    };
  },

  async synchronize() {},
});
