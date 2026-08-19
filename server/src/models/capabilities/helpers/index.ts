import { BooleanEvent, Device, Event, NumericEvent, StringEvent, Op } from "../..";

export type TimeRangeSelector = { since: Date; until: Date };
export type ValueFilter =
  | { eq: number }
  | { ne: number }
  | { gt: number }
  | { gte: number }
  | { lt: number }
  | { lte: number };
export type HistorySelector = TimeRangeSelector & {
  value?: ValueFilter;
  limit?: number;
};

export async function getBooleanProperty(device: Device, propertyName: string, instanceId: string | null = null): Promise<boolean> {
  const latestEvent = await device.getLatestEvent(propertyName, instanceId);
  return !!latestEvent && !latestEvent.end;
}

export async function getLatestBooleanEvent(device: Device, propertyName: string, instanceId: string | null = null): Promise<BooleanEvent | null> {
  const event = await device.getLatestEvent(propertyName, instanceId);
  return event ? new BooleanEvent(event) : null;
}

export async function getLatestNumericEvent(device: Device, propertyName: string, instanceId: string | null = null): Promise<NumericEvent | null> {
  const event = await device.getLatestEvent(propertyName, instanceId);
  return event ? new NumericEvent(event) : null;
}

export async function getLatestStringEvent(device: Device, propertyName: string, instanceId: string | null = null): Promise<StringEvent | null> {
  const event = await device.getLatestEvent(propertyName, instanceId);
  return event ? new StringEvent(event) : null;
}

export async function getStringProperty(device: Device, propertyName: string, defaultValue = '', instanceId: string | null = null): Promise<string> {
  return (await device.getLatestEvent(propertyName, instanceId))?.stringValue ?? defaultValue;
}

export async function setBooleanProperty(device: Device, propertyName: string, propertyValue: boolean, isMomentary: boolean, stateTimestamp: Date = new Date(), reportedAt: Date = stateTimestamp, instanceId: string | null = null): Promise<Event | null> {
  const lastEvent = await device.getLatestEvent(propertyName, instanceId);

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
      type: propertyName,
      instanceId
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
          type: propertyName,
          instanceId
        });
      }
    } else if (lastEvent) {
      lastEvent.lastReported = reportedAt;

      await lastEvent.save();
    }

    return null;
  }
}

export async function getNumericProperty(device: Device, propertyName: string, defaultValue = 0, instanceId: string | null = null): Promise<number> {
  return (await device.getLatestEvent(propertyName, instanceId))?.value ?? defaultValue;
}

export async function setNumericProperty(device: Device, propertyName: string, propertyValue: number, isMomentary: boolean, stateTimestamp: Date = new Date(), reportedAt: Date = stateTimestamp, instanceId: string | null = null): Promise<Event | null> {
  const lastEvent = await device.getLatestEvent(propertyName, instanceId);

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
      type: propertyName,
      instanceId
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
        type: propertyName,
        instanceId
      });
    }

    // Same value, just update lastReported
    lastEvent.lastReported = reportedAt;
    await lastEvent.save();
    return null;
  }
}

export async function setStringProperty(device: Device, propertyName: string, propertyValue: string, isMomentary: boolean, stateTimestamp: Date = new Date(), reportedAt: Date = stateTimestamp, instanceId: string | null = null): Promise<Event | null> {
  const lastEvent = await device.getLatestEvent(propertyName, instanceId);

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
      type: propertyName,
      instanceId
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
        type: propertyName,
        instanceId
      });
    }

    // Same value, just update lastReported
    lastEvent.lastReported = reportedAt;
    await lastEvent.save();
    return null;
  }
}

async function getEventsInRange(device: Device, propertyName: string, selector: HistorySelector, instanceId: string | null = null): Promise<Event[]> {
  let valueWhere: Record<string, unknown> = {};

  if (selector.value) {
    const f = selector.value;
    if ('eq'  in f) valueWhere = { value: f.eq };
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
      instanceId,
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

export async function getPropertyHistory<T extends (BooleanEvent | NumericEvent)>(device: Device, propertyName: string, timeRangeSelector: HistorySelector, eventMapper: (event: Event) => T, instanceId: string | null = null): Promise<T[]> {
  // Returns all events where:
  // - start is after since and before until, OR
  // - start is before since, and end is null or past since
  const events = await getEventsInRange(device, propertyName, timeRangeSelector, instanceId);

  return events.map((event) => eventMapper(event));
}

export async function getBooleanPropertyHistory(device: Device, propertyName: string, timeRangeSelector: HistorySelector, instanceId: string | null = null): Promise<BooleanEvent[]> {
  return getPropertyHistory(device, propertyName, timeRangeSelector, (event) => new BooleanEvent(event), instanceId);
}

export async function getNumericPropertyHistory(device: Device, propertyName: string, timeRangeSelector: HistorySelector, instanceId: string | null = null): Promise<NumericEvent[]> {
  return getPropertyHistory(device, propertyName, timeRangeSelector, (event) => new NumericEvent(event), instanceId);
}

export async function getStringPropertyHistory(device: Device, propertyName: string, timeRangeSelector: HistorySelector, instanceId: string | null = null): Promise<StringEvent[]> {
  const events = await getEventsInRange(device, propertyName, timeRangeSelector, instanceId);
  return events.map((event) => new StringEvent(event));
}