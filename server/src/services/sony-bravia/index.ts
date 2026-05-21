import { Device } from '../../models';
import { TelevisionSource } from '../../models/capabilities';
import config from '../../config';
import logger from '../../logger';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import BraviaClient from './client';

const YOUVIEW_URI = 'com.sony.dtv.com.youview.poa.com.youview.poa.ui.MainActivity';

export type SonySource =
  | { label: string; kind: 'channel'; number: number }
  | { label: string; kind: 'guide' };

function configFor(device: Device) {
  return config.sony_bravia.devices.find(e => e.host === device.providerId);
}

export function sourcesFor(device: Device): SonySource[] {
  const entry = configFor(device);
  const channels: SonySource[] = entry
    ? entry.channels.map(c => ({ label: c.name, kind: 'channel' as const, number: c.number }))
    : [];
  return [{ label: 'TV Guide', kind: 'guide' }, ...channels];
}

function clientFor(device: Device): BraviaClient {
  const entry = configFor(device);

  if (!entry) {
    throw new Error(`No sony-bravia config entry for device ${device.providerId}`);
  }

  return new BraviaClient(entry.host, entry.psk, config.sony_bravia.connect_timeout_milliseconds);
}

function findSource(device: Device, label: string): SonySource | undefined {
  return sourcesFor(device).find(s => s.label === label);
}

Device.registerProvider('sony-bravia', {
  getCapabilities() {
    return ['SWITCH', 'TELEVISION', 'CONNECTIVITY'];
  },

  provideSwitchCapability() {
    return {
      async setIsOn(device: Device, isOn: boolean) {
        await clientFor(device).setIsOn(isOn);
      },
    };
  },

  provideTelevisionCapability() {
    return {
      async setVolume(device: Device, volume: number) {
        await clientFor(device).setVolume(volume);
      },

      async setIsMuted(device: Device, mute: boolean) {
        await clientFor(device).setMute(mute);
      },

      async setCurrentSource(device: Device, label: string) {
        const source = findSource(device, label);

        if (!source) {
          throw new Error(`Unknown TV source "${label}" for device ${device.id}`);
        }

        if (source.kind === 'guide') {
          await clientFor(device).setActiveApp(YOUVIEW_URI);
        } else {
          await clientFor(device).switchToChannel(source.number);
        }
      },
      
      getAvailableSources(device: Device): TelevisionSource[] {
        return sourcesFor(device).map(s => ({ label: s.label, kind: s.kind }));
      },
    };
  },

  async synchronize() {
    for (const entry of config.sony_bravia.devices) {
      let device = await Device.findByProviderId('sony-bravia', entry.host);

      if (device === null) {
        device = Device.build({
          provider: 'sony-bravia',
          providerId: entry.host,
          name: entry.name,
          model: 'Bravia',
        });
      }

      device.manufacturer = 'Sony';

      try {
        const info = await clientFor(device).getSystemInformation();
        device.model = info.model || 'Bravia';
      } catch (err) {
        logger.warn({ err }, `Could not read system info from Bravia ${entry.host}`);
      }

      await device.save();
    }
  }
});

async function pollDevice(device: Device): Promise<boolean> {
  const client = clientFor(device);
  const tv = device.getTelevisionCapability();
  const sw = device.getSwitchCapability();

  let isOn: boolean;

  try {
    isOn = await client.getIsOn();
  } catch (err) {
    logger.debug({ err }, `Bravia ${device.id} unreachable`);
    await sw.setIsOnState(false);
    return false;
  }

  await sw.setIsOnState(isOn);

  if (isOn) {
    try {
      const volume = await client.getVolumeInformation();
      await tv.setVolumeState(volume.volume);
      await tv.setIsMutedState(volume.mute);
    } catch (err) {
      logger.warn({ err }, `Bravia ${device.id} volume read failed`);
    }
  }

  return true;
}

nowAndSetInterval(createBackgroundTransaction('sony-bravia:poll', async () => {
  const devices = await Device.findByProvider('sony-bravia');

  await Promise.all(devices.map(async device => {
    const isConnected = await pollDevice(device);
    await device.getConnectivityCapability().setIsConnectedState(isConnected);
  }));
}), Math.max(config.sony_bravia.poll_interval_seconds, 5) * 1000);
