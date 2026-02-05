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

type HeatingMode = 'AT_HOME' | 'AWAY';

// Module state
let currentMode: HeatingMode = 'AT_HOME';
let currentWarmupState: WarmupState = null;

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
    currentWarmupState = null;
    return;
  }

  const etaTime = dayjs(nextEta.eta);
  const thermostatDevices = await Device.findByCapability('THERMOSTAT');

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

      return { device, scheduledTemp, warmupRate, startTime, thermostat };
    })
  );

  const validWarmupData = deviceWarmupData.filter((x): x is NonNullable<typeof x> => x !== null);

  if (validWarmupData.length === 0) {
    currentWarmupState = null;
    return;
  }

  const earliestStartTime = validWarmupData.reduce<Dayjs>(
    (earliest, curr) => curr.startTime.isBefore(earliest) ? curr.startTime : earliest,
    validWarmupData[0].startTime
  );

  currentWarmupState = {
    preWarmStartTime: earliestStartTime.toDate(),
    targetEta: nextEta.eta
  };

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

  const runCheck = createBackgroundTransaction('automations:heating-warmup', async () => {
    if (currentMode === 'AT_HOME') {
      await checkAtHomeWarmup(minWarmUpRatePerHour);
    } else {
      await checkAwayWarmup(minWarmUpRatePerHour, enableDHWControl);
    }
  });

  // Initialize mode based on current state
  Stay.checkIfSomeoneHomeAt(new Date()).then(isSomeoneHome => {
    currentMode = isSomeoneHome ? 'AT_HOME' : 'AWAY';
    logger.info(`Heating warmup: Starting in ${currentMode} mode`);
    runCheck();
  });

  // Single interval, dispatches based on mode
  setInterval(runCheck, intervalMs);

  // Event handlers update mode and trigger immediate check
  bus.on(FIRST_USER_HOME, () => {
    logger.info('Heating warmup: User arrived, switching to AT_HOME');
    currentMode = 'AT_HOME';
    currentWarmupState = null;
    runCheck();
  });

  bus.on(LAST_USER_LEAVES, () => {
    logger.info('Heating warmup: User left, switching to AWAY');
    currentMode = 'AWAY';
    runCheck();
  });

  bus.on(STAY_START, (stay) => {
    if (stay.eta && !stay.arrival && currentMode === 'AWAY') {
      logger.info('Heating warmup: New ETA set while away, recalculating');
      runCheck();
    }
  });
}
