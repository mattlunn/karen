import { Device, CapabilityInstance } from '../../models';
import { Capability } from '../../models/capabilities';
import logger from '../../logger';
import { publishCommand, sendRpcRequest } from './mqtt';

const TOPIC_PREFIX = 'shellies';

// Shelly Presence: lower SNR = more sensitive (range 10-100, threshold for how
// much signal-over-noise is required to count as a detection).
// App model: higher value = more sensitive (range 0-100)
function snrToSensitivity(snr: number): number {
  return Math.round((100 - snr) / (100 - 10) * 100);
}

function sensitivityToSnr(sensitivity: number): number {
  return Math.round(100 - sensitivity / 100 * (100 - 10));
}

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
        return ['CONTACT_SENSOR', 'BATTERY_LEVEL_INDICATOR'];

      case 'S4SN-0U61X': // Shelly Presence Gen4 (mmWave, multi-zone)
        return ['MOTION_SENSOR', 'MOTION_SENSOR_SENSITIVITY', 'CONNECTIVITY'];

      default:
        throw new Error(`Cannot infer capabilities for device ${device.id} (${device.model})`);
    }
  },

  getCapabilityInstances(device: Device, capability: Capability): CapabilityInstance[] {
    // For Shelly Presence Gen4.
    if (capability === 'MOTION_SENSOR' && Array.isArray(device.meta.zones)) {
      return (device.meta.zones as { id: string; name: string }[]).map(({ id, name }) => ({ id, name }));
    }

    return [{ id: null, name: null }];
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

  provideMotionSensorSensitivityCapability() {
    return {
      // Presence Gen4 is WiFi/mains-powered rather than a sleeping battery node, so
      // a write is confirmed by its RPC response before setSensitivity even returns.
      // There's never an unconfirmed write to report.
      getPendingSensitivity() {
        return null;
      },

      async setSensitivity(device: Device, sensitivity: number) {
        await sendRpcRequest(device.providerId, 'Presence.SetConfig', {
          config: { sensor: { snr: sensitivityToSnr(sensitivity) } }
        });

        await device.getMotionSensorSensitivityCapability().setSensitivityState(sensitivity);
      }
    };
  },

  async synchronize() {
    const devices = await Device.findByProvider('shelly');

    for (const device of devices) {
      try {
        if (!device.getCapabilities().includes('MOTION_SENSOR_SENSITIVITY')) {
          continue;
        }

        const sensitivityEvent = await device.getMotionSensorSensitivityCapability().getSensitivityEvent();

        if (sensitivityEvent !== null) {
          continue;
        }

        const result = await sendRpcRequest(device.providerId, 'Shelly.GetConfig') as { presence?: { sensor?: { snr?: number } } };
        const snr = result.presence?.sensor?.snr;

        if (typeof snr === 'number') {
          await device.getMotionSensorSensitivityCapability().setSensitivityState(snrToSensitivity(snr), device.createdAt);

          logger.info(`Initialized sensitivity for shelly motion sensor device ${device.id}`);
        }
      } catch (e) {
        // Don't let one misbehaving device (unreachable, unknown model, etc.)
        // abort sync for every device after it.
        logger.error(e, `Failed to synchronize shelly device ${device.id}`);
      }
    }
  },
});
