import { Device } from '../../models';
import config from '../../config';
import logger from '../../logger';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import BraviaClient, { BraviaError } from './client';

export interface SonySource {
  label: string;
  uri: string;
  kind: 'input' | 'channel';
}

function clientFor(device: Device): BraviaClient {
  return new BraviaClient(
    device.meta.host as string,
    device.meta.psk as string,
    config.sony_bravia.connect_timeout_milliseconds
  );
}

function findSource(device: Device, label: string): SonySource | undefined {
  const sources = (device.meta.sources as SonySource[] | undefined) ?? [];
  return sources.find(s => s.label === label);
}

function findSourceByUri(device: Device, uri: string): SonySource | undefined {
  const sources = (device.meta.sources as SonySource[] | undefined) ?? [];
  return sources.find(s => s.uri === uri);
}

Device.registerProvider('sony-bravia', {
  getCapabilities() {
    return ['SWITCH', 'TELEVISION', 'CONNECTIVITY'];
  },

  provideSwitchCapability() {
    return {
      async setIsOn(device: Device, isOn: boolean) {
        await clientFor(device).setPowerStatus(isOn);
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

        await clientFor(device).setPlayContent(source.uri);
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

      const sources: SonySource[] = [
        ...entry.inputs.map(i => ({ label: i.label, uri: i.uri, kind: 'input' as const })),
        ...entry.channels.map(c => ({ label: c.name, uri: c.uri, kind: 'channel' as const })),
      ];

      device.meta.host = entry.host;
      device.meta.psk = entry.psk;
      device.meta.sources = sources;

      device.manufacturer = 'Sony';

      // Model is cosmetic enrichment; a TV that's unreachable at startup
      // must not block the config -> DB upsert.
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

  let powerStatus: 'active' | 'standby';

  try {
    powerStatus = await client.getPowerStatus();
  } catch (err) {
    logger.debug({ err }, `Bravia ${device.id} unreachable`);
    return false;
  }

  await sw.setIsOnState(powerStatus === 'active');

  if (powerStatus === 'active') {
    // Volume/source only meaningful while the TV is on.
    const [volumeResult, contentResult] = await Promise.allSettled([
      client.getVolumeInformation(),
      client.getPlayingContentInfo(),
    ]);

    if (volumeResult.status === 'fulfilled') {
      await tv.setVolumeState(volumeResult.value.volume);
      await tv.setIsMutedState(volumeResult.value.mute);
    } else if (!(volumeResult.reason instanceof BraviaError && volumeResult.reason.code === 7)) {
      logger.warn({ err: volumeResult.reason }, `Bravia ${device.id} volume read failed`);
    }

    if (contentResult.status === 'fulfilled' && contentResult.value !== null) {
      const matched = findSourceByUri(device, contentResult.value.uri);
      await tv.setCurrentSourceState(matched?.label ?? contentResult.value.uri);
    } else if (contentResult.status === 'rejected') {
      logger.warn({ err: contentResult.reason }, `Bravia ${device.id} content read failed`);
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
