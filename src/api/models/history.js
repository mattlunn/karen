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
    return await this._getOrRetrieveLastEventOfType('target');
  }

  async currentTemperature() {
    return await this._getOrRetrieveLastEventOfType('temperature');
  }

  isHeating() {
    throw new Error('TODO');
  }

  async humidity() {
    return await this._getOrRetrieveLastEventOfType('humidity');
  }

  async power() {
    return await this._getOrRetrieveLastEventOfType('power');
  }
}

class LightHistoryEvent extends HistoryEvent {
  isOn() {
    throw new Error('TODO');
  }

  async brightness() {
    return await this._getOrRetrieveLastEventOfType('brightness');
  }

  async power() {
    return await this._getOrRetrieveLastEventOfType('power');
  }
}

class HistoryDatum {
  constructor(device, period, lastEventRetriever) {
    this._device = device;
    this._getOrRetrieveLastEventOfType = lastEventRetriever;

    this.period = period;
  }

  datum() {
    switch (this._device.type) {
      case 'thermostat':
        return new ThermostatHistoryEvent(this.period.start, this._device, this._getOrRetrieveLastEventOfType);
      case 'light':
        return new LightHistoryEvent(this.period.start, this._device, this._getOrRetrieveLastEventOfType);
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
        return events[type].value;
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

      return deviceEvents.get(type).then(({ value }) => value);
    };
  }

  async data(_, __, { variableValues: { from, to, interval, type, ids }}) {
    const deviceToIdMap = await this._getDeviceMap(type, ids);
    const events = await this._getEvents(Array.from(deviceToIdMap.keys()), from, to);
    const lasts = new Map(Array.from(deviceToIdMap.values()).map(x => ([x, {}])));
    const ret = [];

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

      ret.push(...Array.from(lasts).map(([device, deviceEvents]) => new HistoryDatum(device, new TimePeriod({
        start: currentPeriodStart,
        end: currentPeriodStart + interval
      }), this._createGetterForDeviceTypes(device, { ...deviceEvents }))));
    }

    return ret;
  }
}