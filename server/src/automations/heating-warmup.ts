import bus, { NOTIFICATION_TO_ADMINS, FIRST_USER_HOME, LAST_USER_LEAVES, STAY_START, STAY_END } from '../bus';
import { Device, Stay, Event, Op } from '../models';
import { setDHWMode, getDHWMode } from '../services/ebusd';
import dayjs, { Dayjs } from '../dayjs';
import { createBackgroundTransaction } from '../helpers/newrelic';
import logger from '../logger';
import nowAndSetInterval from '../helpers/now-and-set-interval';

type HeatingWarmupParameters = {
  checkIntervalMinutes: number;
  minWarmUpRatePerHour: number;
  enableDHWControl: boolean;
};

type WarmupState = Date | null;

let currentWarmupState: WarmupState = null;

export function getPreWarmStartTime(): WarmupState {
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

export default function ({
  checkIntervalMinutes,
  minWarmUpRatePerHour,
  enableDHWControl = true
}: HeatingWarmupParameters) {
  async function calculateWarmupStartTime(device: Device, nextTarget: number, targetTime: Date): Promise<Dayjs | null>{
    const [currentTemp, currentTarget] = await Promise.all([
      device.getThermostatCapability().getCurrentTemperature(),
      device.getThermostatCapability().getTargetTemperature()
    ]);

    if (nextTarget <= currentTarget) return null;

    const warmupRate = Math.max(await getWarmupRatePerHour(device), minWarmUpRatePerHour);

    if (warmupRate === 0) return null;

    const tempDifference = nextTarget - currentTemp;
    const hoursNeeded = tempDifference / warmupRate;

    return dayjs(targetTime).subtract(hoursNeeded, 'hour');
  }

  async function checkAtHomeWarmup(): Promise<void> {
    const thermostatDevices = await Device.findByCapability('THERMOSTAT');

    currentWarmupState = null;

    for (const device of thermostatDevices) {
      const thermostat = device.getThermostatCapability();
      const nextScheduledChange = await thermostat.getNextScheduledChange();

      if (nextScheduledChange) {
        const startTime = await calculateWarmupStartTime(device, nextScheduledChange.temperature, nextScheduledChange.timestamp);

        if (dayjs().isAfter(startTime)) {
          await thermostat.setTargetTemperature(nextScheduledChange.temperature);
        }
      }
    }
  }

  async function checkAwayWarmup(
    etaTime: Date,
    enableDHWControl: boolean
  ): Promise<void> {    
    const setTargetTemperatureActors = [];
    let earliestWarmup: Dayjs | null = null;

    for (const device of await Device.findByCapability('THERMOSTAT')) {
      const thermostat = device.getThermostatCapability();
      const scheduledTemp = await thermostat.getScheduledTemperatureAtTime(etaTime);

      if (scheduledTemp) {
        const startTime = await calculateWarmupStartTime(device, scheduledTemp, etaTime);

        if (earliestWarmup === null || startTime?.isBefore(earliestWarmup)) {
          earliestWarmup = startTime;
        }

        setTargetTemperatureActors.push(() => thermostat.setTargetTemperature(scheduledTemp));
      }
    }

    currentWarmupState = earliestWarmup?.toDate() ?? null;
    logger.info(`Calculated warmup start time ${currentWarmupState?.toISOString() ?? 'N/A'}`);

    if (earliestWarmup === null || earliestWarmup.isAfter(dayjs())) {
      return;
    }

    for (const setTargetTemperature of setTargetTemperatureActors) {
      await setTargetTemperature();
    }

    if (enableDHWControl) {
      const dhwIsOn = await getDHWMode();

      if (!dhwIsOn) {
        await setDHWMode(true);
      }
    }

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `Pre-heating started.`
    });
  }

  const intervalMs = Math.max(checkIntervalMinutes, 1) * 60 * 1000;
  const runCheck = createBackgroundTransaction('automations:heating-warmup', async () => {
    const isSomeoneHome = await Stay.checkIfSomeoneHomeAt(new Date());
    const nextEta = await Stay.findNextUpcomingEta();

    if (isSomeoneHome) {
      await checkAtHomeWarmup();
    } else if (nextEta) {
      await checkAwayWarmup(nextEta.eta, enableDHWControl);
    }
  });

  nowAndSetInterval(runCheck, intervalMs);

  // Handles ETA being set, and (first) user home.
  bus.on(STAY_START, () => {
    runCheck();
  });

  // In case previous user has already left and set an ETA, and now the house is empty.
  bus.on(LAST_USER_LEAVES, () => {
    runCheck();
  });
}
