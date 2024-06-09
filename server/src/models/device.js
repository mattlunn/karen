import Sequelize, { Op } from 'sequelize';
import bus, { DEVICE_PROPERTY_CHANGED } from '../bus';

const latestEventCache = new Map();

export default function (sequelize) {
  const device = sequelize.define('device', {
    type: {
      type: Sequelize.STRING,
      allowNull: false
    },

    name: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    },

    provider: {
      type: Sequelize.STRING,
      allowNull: false
    },

    providerId: {
      type: Sequelize.STRING,
      allowNull: true
    },

    metaStringified: {
      type: Sequelize.STRING,
      allowNull: true
    },

    meta: {
      type: Sequelize.VIRTUAL,
      get() {
        if (!this._metaParsed) {
          try {
            this._metaParsed = JSON.parse(this.metaStringified);
          } catch (e) {
            this._metaParsed = {};
          }
        }

        return this._metaParsed;
      }
    }
  }, {
    paranoid: true
  });

  /**
   * This method triggers the update of the property at the service level. It does
   * not wait for the property to update before returning.
   *
   * In other words, by awaiting this method, you are subscribing to "I have successfully
   * told (e.g. Tado) to change the temperature". It does NOT mean "The temperature has changed."
   *
   * In part, this is due to some APIs (TP Link, Tado, I'm looking at you), where we have
   * to poll for updates, rather than subscribe to updates.
   */
  device.prototype.setProperty = function (property, value) {
    return device._providers.get(this.provider).setProperty(this, property, value);
  };

  device.prototype.onPropertyChanged = function (property) {
    bus.emit(DEVICE_PROPERTY_CHANGED, {
      device: this,
      property
    });
  };

  device.prototype.getProperty = function (property) {
    return device._providers.get(this.provider).getProperty(this, property);
  };

  device.prototype.getLatestEvent = async function (type) {
    // We have this caching because MySQL's chosen query execution plan seems to suite EITHER
    // IDs + types which never change (e.g. the brightness of a non-dimmable light), OR a type
    // which changes often (e.g. the temperature). The bad query plans resulted in >500ms queries.
    //
    // By introducing this caching, the query for both these scenarios should be more similar,
    // as in both cases they will only have to check cached value -> now, rather than the history
    // of time.
    
    if (!latestEventCache.has(this.id)) {
      latestEventCache.set(this.id, new Map());
    }

    let lastLatestEvent = latestEventCache.get(this.id).get(type);
    const newerLatestEvent = (await this.getEvents({
      where: {
        type,
        start: {
          [Op.gte]: lastLatestEvent?.start || '1970-01-01T00:00:00.000Z'
        }
      },

      limit: 1,
      order: [['start', 'DESC']]
    }))[0] || null;

    if (!lastLatestEvent || (newerLatestEvent && newerLatestEvent.start >= lastLatestEvent.start)) {
      lastLatestEvent = newerLatestEvent;
      latestEventCache.get(this.id).set(type, lastLatestEvent);
    }

    return lastLatestEvent;
  };

  device.findByName = function (name) {
    return this.findOne({
      where: {
        name
      }
    });
  };

  device.findById = function (id) {
    return this.findOne({
      where: {
        id
      }
    });
  };

  device.findByProviderId = function (provider, id) {
    return this.findOne({
      where: {
        provider,
        providerId: id
      }
    });
  };

  device.findByProvider = function (provider) {
    return this.findAll({
      where: {
        provider
      }
    });
  };

  device.findByType = function (type) {
    return this.findAll({
      where: {
        type
      }
    });
  };

  device.synchronize = async function () {
    for (const [name, { synchronize }] of device._providers) {
      console.log(`Synchronizing ${name}`);

      await synchronize();
    }
  };

  device._providers = new Map();
  device.registerProvider = function (name, handlers) {
    this._providers.set(name, handlers);

    handlers.synchronize();
  };

  device.addHook('beforeSave', (instance) => {
    instance.metaStringified = JSON.stringify(instance.meta);
  });

  return device;
}
