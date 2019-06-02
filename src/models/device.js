import Sequelize from 'sequelize';

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
    classMethods: {
      setProperty(key, value) {
        return device._providers.get(this.provider).setProperty(this, key, value);
      },

      getProperty(key) {
        return device._providers.get(this.provider).getProperty(this, key);
      },

      async getLatestEvent(type) {
        return (await this.getEvents({
          where: {
            type
          },

          limit: 1,
          order: [['start', 'DESC']]
        }))[0] || null;
      }
    }
  });

  device.findByProviderId = function (provider, id) {
    return this.findOne({
      where: {
        provider,
        providerId: id
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
};