import TimePeriod from './time-period';
import * as db from '../../models';

const Op = db.Op;

class HistoryEvent {
  constructor(start, device, lastEventRetriever) {
    this._device = device;
    this._getOrRetrieveLastEventOfType = lastEventRetriever;

    this._start = start;
  }

  id() {
    return this._device.id;
  }

  name() {
    return this._device.name;
  }
}

class ThermostatHistoryEvent extends HistoryEvent {
  async targetTemperature() {
    return (await this._getOrRetrieveLastEventOfType('target')).value;
  }

  async currentTemperature() {
    return (await this._getOrRetrieveLastEventOfType('temperature')).value;
  }

  async isHeating() {
    const previousEvent = await this._getOrRetrieveLastEventOfType('heating');

    if (!previousEvent.end) {
      return true;
    }

    return previousEvent.end > this._start;
  }

  async humidity() {
    return (await this._getOrRetrieveLastEventOfType('humidity')).value;
  }

  async power() {
    return (await this._getOrRetrieveLastEventOfType('power')).value;
  }
}

class LightHistoryEvent extends HistoryEvent {
  async isOn() {
    const previousEvent = await this._getOrRetrieveLastEventOfType('on');

    if (!previousEvent.end) {
      return true;
    }

    return previousEvent.end > this._start;
  }

  async brightness() {
    return (await this._getOrRetrieveLastEventOfType('brightness')).value;
  }

  async power() {
    return (await this._getOrRetrieveLastEventOfType('power')).value;
  }
}

class HistoryDatum {
  constructor(device, start, end, lastEventRetriever) {
    this._device = device;
    this._getOrRetrieveLastEventOfType = lastEventRetriever;
    this._start = start;
    this._end = end;

    this.period = new TimePeriod({ start, end });
  }

  datum() {
    switch (this._device.type) {
      case 'thermostat':
        return new ThermostatHistoryEvent(this._start, this._device, this._getOrRetrieveLastEventOfType);
      case 'light':
        return new LightHistoryEvent(this._start, this._device, this._getOrRetrieveLastEventOfType);
    }
  }
}

export default class History {
  constructor({ from }) {
    this._previousDeviceTypeEvents = new Map();
    this._start = from;
  }

  async _getDeviceMap(type, ids) {
    const devices = ids
      ? await db.Device.findAll({
          where: {
            type: type,
            id: ids
          }
        })
      : await db.Device.findByType(type);

    return new Map(devices.map(x => [x.id.toString(), x]));
  }

  _getEvents(deviceIds, from, to) {
    return db.Event.findAll({
      where: {
        deviceId: deviceIds,
        start: {
          [db.Op.gte]: from,
          [db.Op.lt]: to
        },
        end: {
          [db.Op.gte]: from,
          [db.Op.lt]: to
        }
      },

      order: ['start']
    });
  }

  _createGetterForDeviceTypes(device, events) {
    return (type) => {
      if (events[type]) {
        return events[type];
      }

      if (!this._previousDeviceTypeEvents.has(device)) {
        this._previousDeviceTypeEvents.set(device, new Map());
      }

      const deviceEvents = this._previousDeviceTypeEvents.get(device);

      if (!deviceEvents.has(type)) {
        deviceEvents.set(type, new Promise((res, rej) => {
          return db.Event.findOne({
            where: {
              deviceId: device.id.toString(),
              type,

              start: {
                [Op.lt]: this._start
              }
            },

            order: [['start', 'DESC']]
          }).then(res, rej);
        }));
      }

      return deviceEvents.get(type);
    };
  }

  async data(_, __, { variableValues: { from, to, interval, type, ids }}) {
    const deviceToIdMap = await this._getDeviceMap(type, ids);
    const events = await this._getEvents(Array.from(deviceToIdMap.keys()), from, to);
    const lasts = new Map(Array.from(deviceToIdMap.values()).map(x => ([x, {}])));
    const ret = [];

    if (interval === 0) {
      throw new Error('Interval cannot be 0');
    }

    let currentIndex = 0;
    let currentElement = events[currentIndex];

    for (let currentPeriodStart=from; currentPeriodStart<=to; currentPeriodStart+=interval) {
      while (currentIndex < events.length) {
        if (currentElement.start > currentPeriodStart) {
          break;
        }

        lasts.get(deviceToIdMap.get(currentElement.deviceId))[currentElement.type] = currentElement;

        currentIndex++;
        currentElement = events[currentIndex];
      }

      ret.push(...Array.from(lasts).map(([device, deviceEvents]) => new HistoryDatum(device, currentPeriodStart, currentPeriodStart + interval, this._createGetterForDeviceTypes(device, { ...deviceEvents }))));
    }

    return ret;
  }
}