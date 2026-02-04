import bus, { NOTIFICATION_TO_ADMINS, FIRST_USER_HOME, LAST_USER_LEAVES, STAY_START } from '../bus';
import { Device, Stay, Event, Op } from '../models';
import { setDHWMode, getDHWMode } from '../services/ebusd';
import dayjs, { Dayjs } from '../dayjs';
import { createBackgroundTransaction } from '../helpers/newrelic';
import logger from '../logger';

type HeatingWarmupParameters = {
  checkIntervalMinutes: number;
  minWarmUpRatePerHour: number;
  enableDHWControl: boolean;
};

type WarmupState = {
  preWarmStartTime: Date;
  targetEta: Date;
} | null;

// Singleton state for API access
let currentWarmupState: WarmupState = null;

export function getWarmupState(): WarmupState {
  return currentWarmupState;
}

function clearWarmupState(): void {
  currentWarmupState = null;
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

async function checkAtHomeWarmup(minWarmUpRatePerHour: number): Promise<void> {
  const thermostatDevices = await Device.findByCapability('THERMOSTAT');

  for (const device of thermostatDevices) {
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
      await thermostat.setTargetTemperature(nextChange.temperature);

      bus.emit(NOTIFICATION_TO_ADMINS, {
        message: `Setting "${device.name}" to ${nextChange.temperature.toFixed(1)}° to warm up by ${warmupRate.toFixed(1)}°/hr and reach target by ${dayjs(nextChange.timestamp).format('HH:mm')}`
      });
    }
  }
}

async function checkAwayWarmup(
  minWarmUpRatePerHour: number,
  enableDHWControl: boolean
): Promise<void> {
  const nextEta = await Stay.findNextUpcomingEta();

  if (!nextEta || !nextEta.eta) {
    clearWarmupState();
    return;
  }

  const etaTime = dayjs(nextEta.eta);
  const thermostatDevices = await Device.findByCapability('THERMOSTAT');

  // Calculate warmup requirements for each device
  const deviceWarmupData = await Promise.all(
    thermostatDevices.map(async device => {
      const thermostat = device.getThermostatCapability();
      const [currentTemp, targetTemp, scheduledTemp] = await Promise.all([
        thermostat.getCurrentTemperature(),
        thermostat.getTargetTemperature(),
        thermostat.getScheduledTemperatureAtTime(nextEta.eta!)
      ]);

      if (scheduledTemp === null || scheduledTemp <= targetTemp) {
        return null;
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
        startTime,
        thermostat
      };
    })
  );

  const validWarmupData = deviceWarmupData.filter((x): x is NonNullable<typeof x> => x !== null);

  if (validWarmupData.length === 0) {
    clearWarmupState();
    return;
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
    for (const data of validWarmupData) {
      await data.thermostat.setTargetTemperature(data.scheduledTemp);
    }

    if (enableDHWControl) {
      const dhwIsOn = await getDHWMode();
      if (!dhwIsOn) {
        await setDHWMode(true);
        logger.info('Heating warmup: Enabled DHW as part of pre-heating');
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
}: HeatingWarmupParameters) {
  const intervalMs = Math.max(checkIntervalMinutes, 1) * 60 * 1000;
  let currentInterval: ReturnType<typeof setInterval> | null = null;

  function startAtHomeChecks() {
    if (currentInterval) {
      clearInterval(currentInterval);
    }

    // Run immediately, then on interval
    const runCheck = createBackgroundTransaction('automations:heating-warmup:at-home', () =>
      checkAtHomeWarmup(minWarmUpRatePerHour)
    );

    runCheck();
    currentInterval = setInterval(runCheck, intervalMs);
  }

  function startAwayChecks() {
    if (currentInterval) {
      clearInterval(currentInterval);
    }

    // Run immediately, then on interval
    const runCheck = createBackgroundTransaction('automations:heating-warmup:away', () =>
      checkAwayWarmup(minWarmUpRatePerHour, enableDHWControl)
    );

    runCheck();
    currentInterval = setInterval(runCheck, intervalMs);
  }

  // Initialize based on current state
  Stay.checkIfSomeoneHomeAt(new Date()).then(isSomeoneHome => {
    if (isSomeoneHome) {
      logger.info('Heating warmup: Starting in at-home mode');
      startAtHomeChecks();
    } else {
      logger.info('Heating warmup: Starting in away mode');
      startAwayChecks();
    }
  });

  // Listen for state transitions
  bus.on(FIRST_USER_HOME, () => {
    logger.info('Heating warmup: First user arrived home, switching to at-home mode');
    clearWarmupState();
    startAtHomeChecks();
  });

  bus.on(LAST_USER_LEAVES, () => {
    logger.info('Heating warmup: Last user left, switching to away mode');
    startAwayChecks();
  });

  // When a new stay is created with an ETA, recalculate if we're away
  bus.on(STAY_START, async (stay) => {
    if (stay.eta && !stay.arrival) {
      const isSomeoneHome = await Stay.checkIfSomeoneHomeAt(new Date());
      if (!isSomeoneHome) {
        logger.info('Heating warmup: New ETA set while away, recalculating');
        await checkAwayWarmup(minWarmUpRatePerHour, enableDHWControl);
      }
    }
  });
}
