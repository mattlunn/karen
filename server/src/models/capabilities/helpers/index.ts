import { BooleanEvent, Device, Event, NumericEvent, StringEvent, Op } from "../..";

export type TimeRangeSelector = { since: Date; until: Date };
export type ValueFilter =
  | { eq: string | number }
  | { ne: number }
  | { gt: number }
  | { gte: number }
  | { lt: number }
  | { lte: number };
export type HistorySelector = TimeRangeSelector & {
  value?: ValueFilter;
  limit?: number;
};

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

export async function getLatestStringEvent(device: Device, propertyName: string): Promise<StringEvent | null> {
  const event = await Event.findOne({
    where: { deviceId: device.id, type: propertyName, end: null },
    order: [['start', 'DESC']]
  });
  return event ? new StringEvent(event) : null;
}

export async function getStringProperty(device: Device, propertyName: string, defaultValue = ''): Promise<string> {
  return (await device.getLatestEvent(propertyName))?.stringValue ?? defaultValue;
}

export async function setBooleanProperty(device: Device, propertyName: string, propertyValue: boolean, isMomentary: boolean, stateTimestamp: Date = new Date(), reportedAt: Date = stateTimestamp): Promise<Event | null> {
  const lastEvent = await device.getLatestEvent(propertyName);

  // Reject historic inserts - use reset script instead
  if (lastEvent && stateTimestamp < lastEvent.start) {
    throw new Error(`Cannot insert historic event for ${propertyName}: timestamp ${stateTimestamp.toISOString()} is before latest event ${lastEvent.start.toISOString()}`);
  }

  // Same timestamp as latest event
  if (lastEvent && lastEvent.start.getTime() === stateTimestamp.getTime()) {
    const isCurrentlyOn = !lastEvent.end;

    if (isCurrentlyOn && propertyValue === false) {
      // on -> off at same timestamp: delete the event (zero-duration, never happened)
      await lastEvent.destroy();
      return null;
    }

    if (!isCurrentlyOn && propertyValue === true) {
      // off -> on at same timestamp: shouldn't happen in practice
      throw new Error(`Cannot turn on ${propertyName} at same timestamp as existing event`);
    }

    // Same value at same timestamp: just update lastReported
    lastEvent.lastReported = new Date();
    await lastEvent.save();
    return null;
  }

  if (isMomentary) {
    return await Event.create({
      deviceId: device.id,
      start: stateTimestamp,
      end: stateTimestamp,
      lastReported: reportedAt,
      value: Number(propertyValue),
      type: propertyName
    });
  } else {
    const valueHasChanged = !lastEvent || !lastEvent.end !== propertyValue;

    if (valueHasChanged) {
      // on -> off (update old, don't create new)
      // off -> on (don't touch old, create new)

      if (lastEvent && propertyValue === false) {
        lastEvent.end = stateTimestamp;
        lastEvent.lastReported = reportedAt;

        return await lastEvent.save();
      }

      if (propertyValue === true) {
        return await Event.create({
          deviceId: device.id,
          start: stateTimestamp,
          lastReported: reportedAt,
          value: Number(propertyValue),
          type: propertyName
        });
      }
    } else if (lastEvent) {
      lastEvent.lastReported = reportedAt;

      await lastEvent.save();
    }

    return null;
  }
}

export async function getNumericProperty(device: Device, propertyName: string, defaultValue = 0): Promise<number> {
  return (await device.getLatestEvent(propertyName))?.value ?? defaultValue;
}

export async function setNumericProperty(device: Device, propertyName: string, propertyValue: number, isMomentary: boolean, stateTimestamp: Date = new Date(), reportedAt: Date = stateTimestamp): Promise<Event | null> {
  const lastEvent = await device.getLatestEvent(propertyName);

  // Reject historic inserts - use reset script instead
  if (lastEvent && stateTimestamp < lastEvent.start) {
    throw new Error(`Cannot insert historic event for ${propertyName}: timestamp ${stateTimestamp.toISOString()} is before latest event ${lastEvent.start.toISOString()}`);
  }

  // Same timestamp as latest event
  if (lastEvent && lastEvent.start.getTime() === stateTimestamp.getTime()) {
    if (lastEvent.value !== propertyValue || lastEvent.lastReported.getTime() !== reportedAt.getTime()) {
      lastEvent.value = propertyValue;
      lastEvent.lastReported = reportedAt;
      return await lastEvent.save();
    }
    return null; // No change needed
  }

  if (isMomentary) {
    return await Event.create({
      deviceId: device.id,
      start: stateTimestamp,
      end: stateTimestamp,
      lastReported: reportedAt,
      value: propertyValue,
      type: propertyName
    });
  } else {
    // Normal forward flow
    const valueHasChanged = !lastEvent || propertyValue !== lastEvent.value;

    if (valueHasChanged) {
      if (lastEvent) {
        lastEvent.end = stateTimestamp;
        lastEvent.lastReported = reportedAt;
        await lastEvent.save();
      }

      return await Event.create({
        deviceId: device.id,
        start: stateTimestamp,
        lastReported: reportedAt,
        value: propertyValue,
        type: propertyName
      });
    }

    // Same value, just update lastReported
    lastEvent.lastReported = reportedAt;
    await lastEvent.save();
    return null;
  }
}

export async function setStringProperty(device: Device, propertyName: string, propertyValue: string, isMomentary: boolean, stateTimestamp: Date = new Date(), reportedAt: Date = stateTimestamp): Promise<Event | null> {
  const lastEvent = await device.getLatestEvent(propertyName);

  // Reject historic inserts - use reset script instead
  if (lastEvent && stateTimestamp < lastEvent.start) {
    throw new Error(`Cannot insert historic event for ${propertyName}: timestamp ${stateTimestamp.toISOString()} is before latest event ${lastEvent.start.toISOString()}`);
  }

  // Same timestamp as latest event
  if (lastEvent && lastEvent.start.getTime() === stateTimestamp.getTime()) {
    if (lastEvent.stringValue !== propertyValue || lastEvent.lastReported.getTime() !== reportedAt.getTime()) {
      lastEvent.stringValue = propertyValue;
      lastEvent.lastReported = reportedAt;
      return await lastEvent.save();
    }
    return null;
  }

  if (isMomentary) {
    return await Event.create({
      deviceId: device.id,
      start: stateTimestamp,
      end: stateTimestamp,
      lastReported: reportedAt,
      stringValue: propertyValue,
      type: propertyName
    });
  } else {
    const valueHasChanged = !lastEvent || propertyValue !== lastEvent.stringValue;

    if (valueHasChanged) {
      if (lastEvent) {
        lastEvent.end = stateTimestamp;
        lastEvent.lastReported = reportedAt;
        await lastEvent.save();
      }

      return await Event.create({
        deviceId: device.id,
        start: stateTimestamp,
        lastReported: reportedAt,
        stringValue: propertyValue,
        type: propertyName
      });
    }

    // Same value, just update lastReported
    lastEvent.lastReported = reportedAt;
    await lastEvent.save();
    return null;
  }
}

async function getEventsInRange(device: Device, propertyName: string, selector: HistorySelector): Promise<Event[]> {
  let valueWhere: Record<string, unknown> = {};

  if (selector.value) {
    const f = selector.value;
    if ('eq'  in f) valueWhere = typeof f.eq === 'string' ? { stringValue: f.eq } : { value: f.eq };
    else if ('ne'  in f) valueWhere = { value: { [Op.ne]:  f.ne  } };
    else if ('gt'  in f) valueWhere = { value: { [Op.gt]:  f.gt  } };
    else if ('gte' in f) valueWhere = { value: { [Op.gte]: f.gte } };
    else if ('lt'  in f) valueWhere = { value: { [Op.lt]:  f.lt  } };
    else if ('lte' in f) valueWhere = { value: { [Op.lte]: f.lte } };
  }

  return Event.findAll({
    where: {
      deviceId: device.id,
      type: propertyName,
      ...valueWhere,
      [Op.or]: [
        {
          start: {
            [Op.gte]: selector.since,
            [Op.lt]: selector.until
          }
        },
        {
          [Op.and]: [
            { start: { [Op.lte]: selector.since } },
            {
              [Op.or]: [
                { end: { [Op.gt]: selector.since } },
                { end: null }
              ]
            }
          ]
        }
      ]
    },
    order: [['start', 'DESC']],
    ...(selector.limit !== undefined && { limit: selector.limit })
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

export async function getStringPropertyHistory(device: Device, propertyName: string, timeRangeSelector: HistorySelector): Promise<StringEvent[]> {
  const events = await getEventsInRange(device, propertyName, timeRangeSelector);
  return events.map((event) => new StringEvent(event));
}

export async function clearStringProperty(device: Device, eventName: string, endTime: Date, reportedAt: Date): Promise<StringEvent | null> {
  const currentEvent = await Event.findOne({
    where: { deviceId: device.id, type: eventName, end: null },
    order: [['start', 'DESC']]
  });

  if (currentEvent) {
    await currentEvent.update({ end: endTime, lastReported: reportedAt });
    return new StringEvent(currentEvent);
  }

  return null;
}