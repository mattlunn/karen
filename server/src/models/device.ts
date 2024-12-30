import { Sequelize, Op, DataTypes, Model, InferAttributes, InferCreationAttributes, HasManyGetAssociationsMixin, CreationOptional, NonAttribute } from 'sequelize';
import bus, { DEVICE_PROPERTY_CHANGED } from '../bus';
import logger from '../logger';
import { Event } from './event';

const latestEventCache = new Map();

export class Device extends Model<InferAttributes<Device>, InferCreationAttributes<Device>> {
  declare id: CreationOptional<number>;
  declare provider: string;
  declare providerId: string;
  declare type: CreationOptional<string>;
  declare name: CreationOptional<string>;
  declare roomId: CreationOptional<number>;
  declare metaStringified: CreationOptional<string>;

  #metaParsed: Record<string, unknown>;

  declare getEvents: HasManyGetAssociationsMixin<{ start: Date; }>;

  get meta(): NonAttribute<Record<string, unknown>> {
    if (!this.#metaParsed) {
      try {
        this.#metaParsed = JSON.parse(this.metaStringified);
      } catch (e) {
        this.#metaParsed = {};
      }
    }

    return this.#metaParsed;
  }

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
  setProperty<T>(property: string, value: T) {
    return Device._providers.get(this.provider)!.setProperty(this, property, value);
  };

  onPropertyChanged(property: string) {
    bus.emit(DEVICE_PROPERTY_CHANGED, {
      device: this,
      property
    });
  };

  async getProperty<T>(property: string): Promise<T> {
    return (await Device._providers.get(this.provider)!.getProperty(this, property)) as T;
  };

  async getLatestEvent(type: string): Promise<Event | null> {
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

  static findByName(name: string) {
    return this.findOne({
      where: {
        name
      }
    });
  };

  static findById(id: string) {
    return this.findOne({
      where: {
        id
      }
    });
  };

  static findByProviderId(provider: string, id: string) {
    return this.findOne({
      where: {
        provider,
        providerId: id
      }
    });
  };

  static async findByProviderIdOrError(provider: string, id: string) {
    const device = await this.findOne({
      where: {
        provider,
        providerId: id
      }
    });

    if (device === null) {
      throw new Error(`Device ${id} from ${provider} not found`);
    }

    return device;
  };

  static findByProvider(provider: string) {
    return this.findAll({
      where: {
        provider
      }
    });
  };

  static findByType(type: string) {
    return this.findAll({
      where: {
        type
      }
    });
  };

  static async synchronize() {
    for (const [name, { synchronize }] of Device._providers) {
      logger.info(`Synchronizing ${name}`);

      await synchronize();
    }
  };

  static _providers = new Map<string, ProviderHandler>();

  static registerProvider(name: string, handlers: ProviderHandler) {
    this._providers.set(name, handlers);

    handlers.synchronize();
  };
};

type ProviderHandler = {
  setProperty(device: Device, key: string, value: unknown): void;
  getProperty(device: Device, key: string): Promise<unknown>;
  synchronize(): void;
};

export default function (sequelize: Sequelize) {
  Device.init({
    id: {
      type: DataTypes.NUMBER,
      allowNull: false,
      unique: true,
      primaryKey: true,
      autoIncrement: true
    },

    type: {
      type: DataTypes.STRING,
      allowNull: false
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },

    provider: {
      type: DataTypes.STRING,
      allowNull: false
    },

    providerId: {
      type: DataTypes.STRING,
      allowNull: true
    },

    roomId: {
      type: DataTypes.NUMBER,
      allowNull: true
    },

    metaStringified: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    paranoid: true,
    modelName: 'device'
  });

  Device.addHook('beforeSave', (instance: Device) => {
    instance.metaStringified = JSON.stringify(instance.meta);
  });
}