import config from '../../config/app';
import logger from '../../logger';
import { saveConfig } from '../../helpers/config';
import { Device } from '../../models';
import type { Capability } from '../../models/capabilities';
import { OvenCapability, MicrowaveCapability, DishwasherCapability } from '../../models/capabilities';
import ApiClient from './lib/client';
import type { SseType } from './lib/client';
import { formatProgramName } from './lib/format';

type SSEOperation =
  | { key: 'BSH.Common.Status.OperationState'; value: string; timestamp: number }
  | { key: 'BSH.Common.Root.ActiveProgram'; value: string; timestamp: number }
  | { key: 'BSH.Common.Option.RemainingProgramTime'; value: number; timestamp: number }
  | { key: 'Cooking.Oven.Option.SetpointTemperature'; value: number; timestamp: number }
  | { key: 'Cooking.Oven.Status.CurrentCavityTemperature'; value: number; timestamp: number }
  | { key: 'Dishcare.Dishwasher.Status.SaltNearlyEmpty'; value: boolean; timestamp: number }
  | { key: 'Dishcare.Dishwasher.Status.RinseAidNearlyEmpty'; value: boolean; timestamp: number };

const CAPABILITY_MAP: Record<string, string> = {
  Oven: 'OVEN',
  Microwave: 'MICROWAVE',
  Dishwasher: 'DISHWASHER',
};

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60_000) {
    return cachedToken;
  }

  const res = await fetch('https://api.home-connect.com/security/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.homeconnect.client_id,
      client_secret: config.homeconnect.client_secret,
      refresh_token: config.homeconnect.refresh_token,
    })
  });

  const token = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
  cachedToken = token.access_token;
  tokenExpiresAt = Date.now() + token.expires_in * 1000;

  if (token.refresh_token && token.refresh_token !== config.homeconnect.refresh_token) {
    config.homeconnect.refresh_token = token.refresh_token;
    saveConfig();
  }

  return cachedToken;
}

const client = new ApiClient(getAccessToken);

type ProgramCapability = OvenCapability | MicrowaveCapability | DishwasherCapability;

function programCapability(device: Device, applianceType: string): ProgramCapability {
  switch (applianceType) {
    case 'Oven': return device.getOvenCapability();
    case 'Microwave': return device.getMicrowaveCapability();
    default: return device.getDishwasherCapability();
  }
}

// Also drives the SWITCH capability, so Alexa PowerController and the
// device-page toggle reflect whether a program is running.
async function setRunningProgram(device: Device, capability: ProgramCapability, programName: string | null, ts: Date, now: Date): Promise<void> {
  if (programName === null) {
    await capability.clearProgramNameState(ts, now);
  } else {
    await capability.setProgramNameState(programName, ts, now);
  }

  await device.getSwitchCapability().setIsOnState(programName !== null, ts, now);
}

async function applyItem(device: Device, applianceType: string, item: SSEOperation, now: Date): Promise<void> {
  const ts = new Date(item.timestamp * 1000);

  if (item.key === 'BSH.Common.Status.OperationState') {
    if (!item.value.endsWith('.Run')) {
      await setRunningProgram(device, programCapability(device, applianceType), null, ts, now);
    }

    return;
  }

  if (item.key === 'BSH.Common.Root.ActiveProgram') {
    const programName = item.value ? formatProgramName(item.value) : null;

    await setRunningProgram(device, programCapability(device, applianceType), programName, ts, now);
    return;
  }

  if (applianceType === 'Oven') {
    const capability = device.getOvenCapability();

    if (item.key === 'Cooking.Oven.Option.SetpointTemperature') {
      await capability.setSetpointTemperatureState(item.value, ts, now);
    } else if (item.key === 'Cooking.Oven.Status.CurrentCavityTemperature') {
      await capability.setCurrentTemperatureState(item.value, ts, now);
    }
  } else if (applianceType === 'Microwave') {
    if (item.key === 'BSH.Common.Option.RemainingProgramTime') {
      await device.getMicrowaveCapability().setEstimatedCompletionTimeState(item.timestamp * 1000 + item.value * 1000, ts, now);
    }
  } else if (applianceType === 'Dishwasher') {
    const capability = device.getDishwasherCapability();

    if (item.key === 'BSH.Common.Option.RemainingProgramTime') {
      await capability.setEstimatedCompletionTimeState(item.timestamp * 1000 + item.value * 1000, ts, now);
    } else if (item.key === 'Dishcare.Dishwasher.Status.SaltNearlyEmpty') {
      await capability.setIsSaltLowState(item.value, ts, now);
    } else if (item.key === 'Dishcare.Dishwasher.Status.RinseAidNearlyEmpty') {
      await capability.setIsRinseAidLowState(item.value, ts, now);
    }
  }
}

async function handleSseMessage(msg: { haId: string; items: { key: string; timestamp: number; value: unknown }[] }, type: SseType): Promise<void> {
  const device = await Device.findByProviderIdOrError('homeconnect', msg.haId);
  const now = new Date();

  if (type === 'CONNECTED') {
    await device.getConnectivityCapability().setIsConnectedState(true, now, now);
    return;
  }

  if (type === 'DISCONNECTED') {
    await device.getConnectivityCapability().setIsConnectedState(false, now, now);
    return;
  }

  const applianceType = device.meta.applianceType as string;

  // Process ActiveProgram items before OperationState so the program name is
  // set before the state check potentially clears it
  const sorted = ([...msg.items] as SSEOperation[]).sort((a, b) => {
    const priority = (key: SSEOperation['key']) => key === 'BSH.Common.Root.ActiveProgram' ? 0 : 1;
    return priority(a.key) - priority(b.key);
  });

  for (const item of sorted) {
    try {
      await applyItem(device, applianceType, item, now);
    } catch (err) {
      logger.warn({ err, key: item.key, haId: msg.haId }, 'Home Connect SSE item error');
    }
  }
}

// Hardcoded to 3D Hot Air — the only program used via voice.
const OVEN_DEFAULT_PROGRAM = 'Cooking.Oven.Program.HeatingMode.HotAir3D';
const OVEN_DEFAULT_TEMPERATURE = 200;

Device.registerProvider('homeconnect', {
  getCapabilities(device) {
    const type = device.meta.applianceType as string | undefined;
    const cap = type ? CAPABILITY_MAP[type] : undefined;

    return cap ? [cap as Capability, 'SWITCH', 'CONNECTIVITY'] : [];
  },

  provideSwitchCapability() {
    return {
      setIsOn: async (device: Device, value: boolean) => {
        if (!value) {
          await client.stopActiveProgram(device.providerId);
        } else if (device.meta.applianceType === 'Oven') {
          await client.startActiveProgram(device.providerId, OVEN_DEFAULT_PROGRAM, [
            { key: 'Cooking.Oven.Option.SetpointTemperature', value: OVEN_DEFAULT_TEMPERATURE, unit: '°C' },
          ]);
        } else {
          throw new Error(`Remote start is not supported for the ${device.meta.applianceType}`);
        }
      }
    };
  },

  provideOvenCapability() {
    return {
      setSetpointTemperature: async (device: Device, celsius: number) => {
        await client.startActiveProgram(device.providerId, OVEN_DEFAULT_PROGRAM, [
          { key: 'Cooking.Oven.Option.SetpointTemperature', value: celsius, unit: '°C' },
        ]);
      }
    };
  },

  async synchronize() {
    const appliances = await client.getAppliances();

    for (const appliance of appliances) {
      if (!CAPABILITY_MAP[appliance.type]) {
        continue;
      }

      const existing = await Device.findByProviderId('homeconnect', appliance.haId);

      if (!existing) {
        const device = Device.build({
          provider: 'homeconnect',
          providerId: appliance.haId,
          name: appliance.name,
          manufacturer: 'Home Connect',
          model: appliance.type,
        });
        device.meta.applianceType = appliance.type;
        await device.save();
      }
    }
  }
});

client.subscribeToEvents(handleSseMessage);
