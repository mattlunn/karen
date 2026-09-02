import { Device } from '../../models';
import { TelevisionSource } from '../../models/capabilities';
import config from '../../config/app';
import nowAndSetCron from '../../helpers/now-and-set-cron';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import BraviaClient from './client';

export type SonySource =
  | { label: string; kind: 'channel'; number: number; aliases: string[] }
  | { label: string; kind: 'guide' };

function configFor(device: Device) {
  return config.sony_bravia.devices.find(e => e.host === device.providerId);
}

export function sourcesFor(device: Device): SonySource[] {
  const entry = configFor(device);

  if (!entry) {
    throw new Error(`No sony-bravia config entry for device ${device.providerId}`);
  }

  const channels: SonySource[] = entry.channels.map(c => ({
    label: c.label,
    kind: 'channel' as const,
    number: c.number,
    aliases: c.aliases ?? [],
  }));

  return [{ label: 'TV Guide', kind: 'guide' }, ...channels];
}

function clientFor(device: Device): BraviaClient {
  const entry = configFor(device);

  if (!entry) {
    throw new Error(`No sony-bravia config entry for device ${device.providerId}`);
  }

  return new BraviaClient(entry.host, entry.psk, config.sony_bravia.connect_timeout_milliseconds);
}

// Alexa resolves what the user said against its own idea of our channel
// lineup before sending us channelMetadata.name/number, so the value it sends
// often doesn't match our config's canonical channel label (e.g. "BBC 1"
// instead of "BBC ONE"). There's no general algorithm for this — it's a fixed
// set of per-deployment quirks discovered by testing real voice commands — so
// known variants are enumerated per-channel via config/app.json's `aliases`. Add
// a new alias whenever testing turns up another phrasing Alexa uses.
function findSource(device: Device, label: string): SonySource | undefined {
  const target = label.toLowerCase();

  for (const source of sourcesFor(device)) {
    if (source.label.toLowerCase() === target) {
      return source;
    }

    if (source.kind === 'channel' && (String(source.number) === label || source.aliases.some(a => a.toLowerCase() === target))) {
      return source;
    }
  }

  return undefined;
}

Device.registerProvider('sony-bravia', {
  getCapabilities() {
    return ['SWITCH', 'TELEVISION', 'CONNECTIVITY'];
  },

  provideSwitchCapability() {
    return {
      async setIsOn(device: Device, isOn: boolean) {
        await clientFor(device).setIsOn(isOn);
        await device.getSwitchCapability().setIsOnState(isOn);
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

        const client = clientFor(device);
        await client.wakeAndWaitUntilReady();

        if (source.kind === 'guide') {
          await client.showTvGuide();
        } else {
          await client.switchToChannel(source.number);
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
          manufacturer: 'Sony',
          model: 'Bravia',
        });
      }

      await device.save();
    }
  }
});

async function pollDevice(device: Device) {
  const client = clientFor(device);
  const tv = device.getTelevisionCapability();
  const sw = device.getSwitchCapability();
  const isOn = await client.getIsOn();

  await sw.setIsOnState(isOn);

  if (isOn) {
    const volume = await client.getVolumeInformation();

    await tv.setVolumeState(volume.volume);
    await tv.setIsMutedState(volume.mute);
  }
}

nowAndSetCron(createBackgroundTransaction('sony-bravia:poll', async () => {
  const devices = await Device.findByProvider('sony-bravia');

  await Promise.all(devices.map(async device => {
    try {
      await pollDevice(device);
      await device.getConnectivityCapability().setIsConnectedState(true);
    } catch {
      // A poll failure while the TV is off/unreachable is expected, not
      // exceptional — setIsConnectedState(false) is the meaningful signal
      // here, so don't also propagate the error and spam the background
      // transaction with a failure on every single poll interval.
      await device.getConnectivityCapability().setIsConnectedState(false);
    }
  }));
}), config.sony_bravia.poll_cron);
