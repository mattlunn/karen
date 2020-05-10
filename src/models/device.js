import Sequelize from 'sequelize';
import bus, { DEVICE_PROPERTY_CHANGED } from '../bus';

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
  });

  /**
   * This method triggers the update of the property at the service level. It does
   * not wait for the property to update before returning.
   *
   * In other words, by awaiting this method, you are subscribing to "I have successfully
   * told (e.g. SmartThings) to change the brightness of the light". It does NOT mean "The
   * brightness of the light has changed."
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
    return (await this.getEvents({
      where: {
        type
      },

      limit: 1,
      order: [['start', 'DESC']]
    }))[0] || null;
  };

  device.findByName = function (name) {
    return this.findOne({
      where: {
        name
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