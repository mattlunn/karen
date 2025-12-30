import { BooleanEvent, Device, Event, NumericEvent, Op } from "../..";

type TimeRangeSelector = { since: Date; until: Date };
type LastNSelector = { until: Date; limit: number };

export type HistorySelector = TimeRangeSelector | LastNSelector;

export async function getBooleanProperty(device: Device, propertyName: string): Promise<boolean> {
  const latestEvent = await device.getLatestEvent(propertyName);
  return !!latestEvent && !latestEvent.end;
}

export async function setBooleanProperty(device: Device, propertyName: string, propertyValue: boolean, timestamp: Date = new Date()): Promise<Event | null> {
  const lastEvent = await device.getLatestEvent(propertyName);
  const valueHasChanged = !lastEvent || !lastEvent.end !== propertyValue;

  if (valueHasChanged) {
    // on -> off (update old, don't create new)
    // off -> on (don't touch old, create new)

    if (lastEvent && propertyValue === false) {
      lastEvent.end = timestamp;
      return await lastEvent.save();
    }

    if (propertyValue === true) {
      return await Event.create({
        deviceId: device.id,
        start: timestamp,
        value: Number(propertyValue),
        type: propertyName
      });
    }
  }

  return null;
}

export async function getNumericProperty(device: Device, propertyName: string, defaultValue: number = 0): Promise<number> {
  return (await device.getLatestEvent(propertyName))?.value ?? defaultValue;
}

export async function setNumericProperty(device: Device, propertyName: string, propertyValue: number, timestamp: Date = new Date()): Promise<Event | null> {
  const lastEvent = await device.getLatestEvent(propertyName);
  const valueHasChanged = !lastEvent || propertyValue !== lastEvent.value

  if (valueHasChanged) {
    if (lastEvent) {
      lastEvent.end = timestamp;
      await lastEvent.save();
    }

    return await Event.create({
      deviceId: device.id,
      start: timestamp,
      value: propertyValue,
      type: propertyName
    });
  }

  return null;
}

async function getLastNEventsUntil(device: Device, propertyName: string, timeRangeSelector: LastNSelector): Promise<Event[]> {
  return await Event.findAll({
    where: {
      deviceId: device.id,
      type: propertyName,
      start: {
        [Op.lte]: timeRangeSelector.until
      }
    },
    order: [['start', 'DESC']],
    limit: timeRangeSelector.limit
  });
};

async function getEventsInRange(device: Device, propertyName: string, timeRangeSelector: TimeRangeSelector): Promise<Event[]> {
  return Event.findAll({
    where: {
      deviceId: device.id,
      type: propertyName,
      [Op.or]: [
        // events that start inside the range (since, until]
        {
          start: {
            [Op.gt]: timeRangeSelector.since,
            [Op.lte]: timeRangeSelector.until
          }
        },
        // events that started before or at `since` and either end after since OR have no end (ongoing)
        {
          [Op.and]: [
            { start: { [Op.lte]: timeRangeSelector.since } },
            {
              [Op.or]: [
                { end: { [Op.gt]: timeRangeSelector.since } },
                { end: null }
              ]
            }
          ]
        }
      ]
    },
    order: [['start', 'DESC']]
  });
}

export async function getPropertyHistory<T extends (BooleanEvent | NumericEvent)>(device: Device, propertyName: string, timeRangeSelector: HistorySelector, eventMapper: (event: Event) => T): Promise<T[]> {
  // If limit, last N events until 'until' date (or current one, where end is null)
  // If since + until
  // : all events where start is after since and before until,
  // : all events where start is before since, and end is null or past since,

  const events = 'since' in timeRangeSelector 
    ? await getEventsInRange(device, propertyName, timeRangeSelector)
    : await getLastNEventsUntil(device, propertyName, timeRangeSelector);

  return events.map((event) => eventMapper(event));
}

export async function getBooleanPropertyHistory(device: Device, propertyName: string, timeRangeSelector: HistorySelector): Promise<BooleanEvent[]> {
  return getPropertyHistory(device, propertyName, timeRangeSelector, (event) => new BooleanEvent(event));
}

export async function getNumericPropertyHistory(device: Device, propertyName: string, timeRangeSelector: HistorySelector): Promise<NumericEvent[]> {
  return getPropertyHistory(device, propertyName, timeRangeSelector, (event) => new NumericEvent(event));
}