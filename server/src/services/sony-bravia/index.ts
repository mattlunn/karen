import { Device } from '../../models';
import { TelevisionSource } from '../../models/capabilities';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import BraviaClient from './client';

export type SonySource =
  | { label: string; kind: 'channel'; number: number }
  | { label: string; kind: 'guide' };

function configFor(device: Device) {
  return config.sony_bravia.devices.find(e => e.host === device.providerId);
}

export function sourcesFor(device: Device): SonySource[] {
  const entry = configFor(device);

  if (!entry) {
    throw new Error(`No sony-bravia config entry for device ${device.providerId}`);
  }

  const channels: SonySource[] = entry.channels.map(c => ({ label: c.name, kind: 'channel' as const, number: c.number }));
  return [{ label: 'TV Guide', kind: 'guide' }, ...channels];
}

function clientFor(device: Device): BraviaClient {
  const entry = configFor(device);

  if (!entry) {
    throw new Error(`No sony-bravia config entry for device ${device.providerId}`);
  }

  return new BraviaClient(entry.host, entry.psk, config.sony_bravia.connect_timeout_milliseconds);
}

const WORD_TO_DIGIT: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

// Alexa resolves spoken channel names against its own EPG data before sending
// us channelMetadata.name, so "BBC One" arrives as "BBC 1" — a different
// string to our config's "BBC ONE". Normalize both sides (case, spacing, and
// spelled-out digits) before comparing so wording differences like this don't
// cause a false "unknown channel".
function normalizeChannelLabel(label: string): string {
  return label
    .toLowerCase()
    .split(/\s+/)
    .map(word => WORD_TO_DIGIT[word] ?? word)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

// Confirmed by live testing: Alexa's channel.number for this UK Freeview setup
// isn't our real LCN — it's the old analogue-era terrestrial numbering
// (BBC1=1, BBC2=2, ITV=3, Channel4=4, Five=5), regardless of the declared
// ChannelController `lineup`. Map that fixed, well-known scheme onto whichever
// of our configured channels normalizes to that brand's "1".
const UK_ANALOGUE_CHANNEL_NUMBERS: Record<string, string> = {
  '1': 'bbc1', '2': 'bbc2', '3': 'itv1', '4': 'channel4', '5': 'channel5',
};

function findSource(device: Device, label: string): SonySource | undefined {
  const sources = sourcesFor(device);

  // Alexa sends a bare channel.number (matched against its own guess at our
  // lineup, not necessarily our real LCNs) when the user asks for a channel by
  // digit rather than name — match it directly against our configured numbers.
  const byNumber = sources.find(s => s.kind === 'channel' && String(s.number) === label);
  if (byNumber) {
    return byNumber;
  }

  const target = normalizeChannelLabel(label);
  const exact = sources.find(s => normalizeChannelLabel(s.label) === target);
  if (exact) {
    return exact;
  }

  const analogueTarget = UK_ANALOGUE_CHANNEL_NUMBERS[label];
  if (analogueTarget) {
    const analogueMatch = sources.find(s => normalizeChannelLabel(s.label) === analogueTarget);
    if (analogueMatch) {
      return analogueMatch;
    }
  }

  // Alexa sometimes resolves a spoken brand name without its number (e.g.
  // "itv" for our "ITV1") — a bare name defaults to that brand's "1", matching
  // how our config names multi-channel brands (ITV1/ITV2/ITV3 etc.).
  return sources.find(s => normalizeChannelLabel(s.label) === `${target}1`);
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

nowAndSetInterval(createBackgroundTransaction('sony-bravia:poll', async () => {
  const devices = await Device.findByProvider('sony-bravia');

  await Promise.all(devices.map(async device => {
    try {
      await pollDevice(device);
      await device.getConnectivityCapability().setIsConnectedState(true);
    } catch (e) {
      await device.getConnectivityCapability().setIsConnectedState(false);

      throw e;
    } 
  }));
}), Math.max(config.sony_bravia.poll_interval_seconds, 5) * 1000);
