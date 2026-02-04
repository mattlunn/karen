import bus, { NOTIFICATION_TO_ADMINS } from '../bus';
import { Device, Stay, Event, Op } from '../models';
import { setDHWMode, getDHWMode } from '../services/ebusd';
import dayjs, { Dayjs } from '../dayjs';
import nowAndSetInterval from '../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../helpers/newrelic';
import logger from '../logger';

type ThermostatWarmupParameters = {
  checkIntervalMinutes: number;
  minWarmUpRatePerHour: number;
  enableDHWControl: boolean;
};

type WarmupState = {
  preWarmStartTime: Date | null;
  targetEta: Date | null;
};

// Singleton state for API access
let currentWarmupState: WarmupState = {
  preWarmStartTime: null,
  targetEta: null
};

export function getWarmupState(): WarmupState {
  return currentWarmupState;
}

async function getWarmupRatePerHour(device: Device): Promise<number> {
  const history = await Event.findAll({
    where: {
      deviceId: device.id,
      type: 'power',
      end: {
        [Op.ne]: null
      },
      value: 100
    },
    order: [
      ['end', 'DESC']
    ],
    limit: 20
  });

  if (history.length === 0) {
    return 0;
  }

  const temperatures = await Event.findAll({
    where: {
      deviceId: device.id,
      type: 'temperature',
      [Op.or]: history.map(x => [
        {
          start: { [Op.lte]: x.start },
          end: { [Op.gte]: x.start }
        }, {
          start: { [Op.lte]: x.end },
          end: { [Op.gte]: x.end }
        }
      ]).flat()
    }
  });

  function findTemperatureAtTime(time: Date): number | undefined {
    return temperatures.find(({ start, end }) => start <= time && end !== null && end >= time)?.value;
  }

  const warmupRates = history.reduce<number[]>((acc, { start, end }) => {
    const temperatureAtStart = findTemperatureAtTime(start);
    const temperatureAtEnd = end ? findTemperatureAtTime(end) : undefined;

    if (temperatureAtStart === undefined || temperatureAtEnd === undefined || end === null) {
      return acc;
    }

    const durationInHours = dayjs(end).diff(start, 'h', true);

    if (durationInHours > 0.5 && temperatureAtEnd > temperatureAtStart) {
      acc.push((temperatureAtEnd - temperatureAtStart) / durationInHours);
    }

    return acc;
  }, []);

  if (warmupRates.length === 0) {
    return 0;
  }

  return warmupRates.reduce((acc, curr) => acc + curr, 0) / warmupRates.length;
}

async function handleAtHomeWarmup(
  devices: Device[],
  minWarmUpRatePerHour: number
): Promise<void> {
  for (const device of devices) {
    const thermostat = device.getThermostatCapability();
    const [currentTemp, targetTemp, nextChange] = await Promise.all([
      thermostat.getCurrentTemperature(),
      thermostat.getTargetTemperature(),
      thermostat.getNextScheduledChange()
    ]);

    if (!nextChange) continue;

    // Skip if next target is lower than or equal to current target (no warmup needed)
    if (nextChange.temperature <= targetTemp) continue;

    const warmupRate = Math.max(
      await getWarmupRatePerHour(device),
      minWarmUpRatePerHour
    );

    if (warmupRate === 0) continue;

    const tempDifference = nextChange.temperature - currentTemp;
    const hoursNeeded = tempDifference / warmupRate;
    const startTime = dayjs(nextChange.timestamp).subtract(hoursNeeded, 'hour');

    if (dayjs().isAfter(startTime)) {
      // Time to start warming up
      await thermostat.setTargetTemperature(nextChange.temperature);

      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: `Setting "${device.name}" to ${nextChange.temperature.toFixed(1)}° to warm up by ${warmupRate.toFixed(1)}°/hr and reach target by ${dayjs(nextChange.timestamp).format('HH:mm')}`
      });
    }
  }
}

async function handleAwayWarmup(
  devices: Device[],
  nextEta: Stay,
  minWarmUpRatePerHour: number,
  enableDHWControl: boolean
): Promise<void> {
  const etaTime = dayjs(nextEta.eta);

  // Calculate warmup requirements for each device
  const deviceWarmupData = await Promise.all(
    devices.map(async device => {
      const thermostat = device.getThermostatCapability();
      const [currentTemp, targetTemp, scheduledTemp] = await Promise.all([
        thermostat.getCurrentTemperature(),
        thermostat.getTargetTemperature(),
        thermostat.getScheduledTemperatureAtTime(nextEta.eta!)
      ]);

      if (scheduledTemp === null || scheduledTemp <= targetTemp) {
        return null; // No warmup needed
      }

      const warmupRate = Math.max(
        await getWarmupRatePerHour(device),
        minWarmUpRatePerHour
      );

      if (warmupRate === 0) {
        return null;
      }

      const tempDifference = scheduledTemp - currentTemp;
      const hoursNeeded = tempDifference / warmupRate;
      const startTime = etaTime.subtract(hoursNeeded, 'hour');

      return {
        device,
        scheduledTemp,
        warmupRate,
        hoursNeeded,
        startTime,
        thermostat
      };
    })
  );

  const validWarmupData = deviceWarmupData.filter((x): x is NonNullable<typeof x> => x !== null);

  if (validWarmupData.length === 0) {
    return; // Nothing to warm up
  }

  // Find the earliest start time (longest warmup needed)
  const earliestStartTime = validWarmupData.reduce<Dayjs>(
    (earliest, curr) => curr.startTime.isBefore(earliest) ? curr.startTime : earliest,
    validWarmupData[0].startTime
  );

  // Update state for API access
  currentWarmupState = {
    preWarmStartTime: earliestStartTime.toDate(),
    targetEta: nextEta.eta
  };

  // Check if it's time to start warming
  if (dayjs().isAfter(earliestStartTime)) {
    // Turn on all thermostats together
    for (const data of validWarmupData) {
      await data.thermostat.setTargetTemperature(data.scheduledTemp);
    }

    // Turn on hot water if enabled and currently off
    if (enableDHWControl) {
      const dhwIsOn = await getDHWMode();
      if (!dhwIsOn) {
        await setDHWMode(true);
        logger.info('Thermostat warmup: Enabled DHW as part of pre-heating');
      }
    }

    const deviceNames = validWarmupData.map(d => d.device.name).join(', ');
    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `Pre-heating started for ${deviceNames}. ETA is ${etaTime.format('HH:mm')}.`
    });
  }
}

export default function ({
  checkIntervalMinutes,
  minWarmUpRatePerHour,
  enableDHWControl = true
}: ThermostatWarmupParameters) {

  nowAndSetInterval(createBackgroundTransaction('automations:thermostat-warmup', async () => {
    const [isSomeoneAtHome, nextEta, thermostatDevices] = await Promise.all([
      Stay.checkIfSomeoneHomeAt(new Date()),
      Stay.findNextUpcomingEta(),
      Device.findByCapability('THERMOSTAT')
    ]);

    // Reset state when someone is at home
    if (isSomeoneAtHome) {
      currentWarmupState = { preWarmStartTime: null, targetEta: null };
    }

    if (isSomeoneAtHome) {
      // CASE 1: Someone is home - check each thermostat's next scheduled change
      await handleAtHomeWarmup(thermostatDevices, minWarmUpRatePerHour);
    } else if (nextEta && nextEta.eta) {
      // CASE 2: No one home but ETA exists - synchronize all thermostats
      await handleAwayWarmup(thermostatDevices, nextEta, minWarmUpRatePerHour, enableDHWControl);
    } else {
      // No one home and no ETA - reset state
      currentWarmupState = { preWarmStartTime: null, targetEta: null };
    }
  }), Math.max(checkIntervalMinutes, 1) * 60 * 1000);
}
