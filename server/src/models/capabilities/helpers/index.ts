import { BooleanEvent, Device, Event, NumericEvent, Op } from "../..";

export type TimeRangeSelector = { since: Date; until: Date };
export type HistorySelector = TimeRangeSelector;

export async function getBooleanProperty(device: Device, propertyName: string): Promise<boolean> {
  const latestEvent = await device.getLatestEvent(propertyName);
  return !!latestEvent && !latestEvent.end;
}

export async function getLatestBooleanEvent(device: Device, propertyName: string): Promise<BooleanEvent | null> {
  const event = await device.getLatestEvent(propertyName);
  return event ? new BooleanEvent(event) : null;
}

export async function getLatestNumericEvent(device: Device, propertyName: string): Promise<NumericEvent | null> {
  const event = await device.getLatestEvent(propertyName);
  return event ? new NumericEvent(event) : null;
}

export async function setBooleanProperty(device: Device, propertyName: string, propertyValue: boolean, timestamp: Date = new Date()): Promise<Event | null> {
  const lastEvent = await device.getLatestEvent(propertyName);
  const valueHasChanged = !lastEvent || !lastEvent.end !== propertyValue;

  if (valueHasChanged) {
    // on -> off (update old, don't create new)
    // off -> on (don't touch old, create new)

    if (lastEvent && propertyValue === false) {
      lastEvent.end = timestamp;
      lastEvent.lastReported = timestamp;

      return await lastEvent.save();
    }

    if (propertyValue === true) {
      return await Event.create({
        deviceId: device.id,
        start: timestamp,
        lastReported: timestamp,
        value: Number(propertyValue),
        type: propertyName
      });
    }
  } else if (lastEvent) {
    lastEvent.lastReported = timestamp;

    await lastEvent.save();
  }

  return null;
}

export async function getNumericProperty(device: Device, propertyName: string, defaultValue = 0): Promise<number> {
  return (await device.getLatestEvent(propertyName))?.value ?? defaultValue;
}

export async function setNumericProperty(device: Device, propertyName: string, propertyValue: number, timestamp: Date = new Date()): Promise<Event | null> {
  // First, check if an event already exists at this exact timestamp (for historic updates)
  const existingAtTimestamp = await Event.findOne({
    where: { deviceId: device.id, type: propertyName, start: timestamp }
  });

  if (existingAtTimestamp) {
    // Update existing event if value changed
    if (existingAtTimestamp.value !== propertyValue) {
      existingAtTimestamp.value = propertyValue;
      existingAtTimestamp.lastReported = new Date();
      return await existingAtTimestamp.save();
    }
    return null; // No change needed
  }

  // No existing event at this timestamp - use original logic
  const lastEvent = await device.getLatestEvent(propertyName);
  const valueHasChanged = !lastEvent || propertyValue !== lastEvent.value;

  if (valueHasChanged) {
    if (lastEvent && lastEvent.start < timestamp) {
      lastEvent.end = timestamp;
      lastEvent.lastReported = timestamp;

      await lastEvent.save();
    }

    return await Event.create({
      deviceId: device.id,
      start: timestamp,
      lastReported: timestamp,
      value: propertyValue,
      type: propertyName
    });
  } else if (lastEvent) {
    lastEvent.lastReported = timestamp;

    await lastEvent.save();
  }

  return null;
}

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
  // Returns all events where:
  // - start is after since and before until, OR
  // - start is before since, and end is null or past since
  const events = await getEventsInRange(device, propertyName, timeRangeSelector);

  return events.map((event) => eventMapper(event));
}

export async function getBooleanPropertyHistory(device: Device, propertyName: string, timeRangeSelector: HistorySelector): Promise<BooleanEvent[]> {
  return getPropertyHistory(device, propertyName, timeRangeSelector, (event) => new BooleanEvent(event));
}

export async function getNumericPropertyHistory(device: Device, propertyName: string, timeRangeSelector: HistorySelector): Promise<NumericEvent[]> {
  return getPropertyHistory(device, propertyName, timeRangeSelector, (event) => new NumericEvent(event));
}