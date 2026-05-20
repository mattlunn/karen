import { Device } from '../../models';
import { Capability } from '../../models/capabilities/capabilities.gen';
import { publishCommand } from './mqtt';

const TOPIC_PREFIX = 'shellies';

Device.registerProvider('shelly', {
  getCapabilities(device) {
    switch (device.meta.generation) {
      case 1:
      case 2: {
        const caps: Capability[] = ['LIGHT', 'CONNECTIVITY'];

        if (device.model === 'SHDM-2') {
          caps.push('ENERGY_MONITOR');
        }

        return caps;
      }
      case 3:
        return ['SWITCH', 'CONNECTIVITY'];
      case 4:
        return device.meta.role === 'contact'
          ? ['CONTACT_SENSOR', 'CONNECTIVITY']
          : ['SWITCH', 'CONNECTIVITY'];
      default:
        throw new Error(`Cannot infer capabilities for device ${device.id}`);
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
