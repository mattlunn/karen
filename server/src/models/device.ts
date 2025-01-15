import { Sequelize, Op, DataTypes, Model, InferAttributes, InferCreationAttributes, HasManyGetAssociationsMixin, CreationOptional, NonAttribute } from 'sequelize';
import bus, { DEVICE_PROPERTY_CHANGED } from '../bus';
import logger from '../logger';
import { Event } from './event';
import { Capability, SpeakerCapability, HumiditySensorCapability, LightCapability, MotionSensorCapability, ThermostatCapability, TemperatureSensorCapability, CameraCapability, LightSensorCapability } from './capabilities';

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
  #capabilityCache: Map<(device: Device) => unknown, unknown> = new Map();

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

  onPropertyChanged(property: string) {
    bus.emit(DEVICE_PROPERTY_CHANGED, {
      device: this,
      property
    });
  };

  #getCapabilityOrThrow<T>(handler: (provider: ProviderHandler) => (undefined | ((device: Device) => T))): T {
    const provider = Device._providers.get(this.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${this.provider} does not exist for device ${this.id} (${this.name})`);
    }

    const capabilityProvider = handler(provider);

    if (typeof capabilityProvider !== 'function') {
      throw new Error(`Provider ${this.provider} does not provide support the requested capability (${handler.toString()})`);
    }

    if (!this.#capabilityCache.has(capabilityProvider)) {
      this.#capabilityCache.set(capabilityProvider, capabilityProvider(this));
    }

    return this.#capabilityCache.get(capabilityProvider) as T;
  };

  async getIsConnected(): Promise<boolean> {
    // TODO
    return true;
  }

  getLightCapability(): LightCapability {
    return this.#getCapabilityOrThrow((provider) => provider.getLightCapability);
  };

  getThermostatCapability(): ThermostatCapability {
    return this.#getCapabilityOrThrow((provider) => provider.getThermostatCapability);
  };

  getMotionSensorCapability(): MotionSensorCapability {
    return this.#getCapabilityOrThrow((provider) => provider.getMotionSensorCapability);
  };

  getTemperatureSensorCapability(): TemperatureSensorCapability {
    return this.#getCapabilityOrThrow((provider) => provider.getTemperatureSensorCapability);
  };

  getLightSensorCapability(): LightSensorCapability {
    return this.#getCapabilityOrThrow((provider) => provider.getLightSensorCapability);
  };

  getHumiditySensorCapability(): HumiditySensorCapability {
    return this.#getCapabilityOrThrow((provider) => provider.getHumiditySensorCapability);
  };

  getSpeakerCapability(): SpeakerCapability {
    return this.#getCapabilityOrThrow((provider) => provider.getSpeakerCapability);
  };

  getCapabilities(): Capability[] {
    const provider = Device._providers.get(this.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${this.provider} does not exist for device ${this.id} (${this.name})`);
    }

    return provider.getCapabilities(this);
  }

  hasCapability(capability: Capability): boolean {
    return this.getCapabilities().includes(capability);
  }

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

  static findByName(name: string): Promise<Device | null> {
    return this.findOne({
      where: {
        name
      }
    });
  };

  static async findByNameOrError(name: string): Promise<Device> {
    const device = await this.findByName(name);

    if (device === null) {
      throw new Error(`Device with name ${name} could not be found`);
    }

    return device;
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

    handlers.synchronize().catch(e => logger.error(e));
  };
};

type ProviderHandler = {
  getLightCapability?(device: Device): LightCapability;
  getThermostatCapability?(device: Device): ThermostatCapability;
  getHumiditySensorCapability?(device: Device): HumiditySensorCapability;
  getTemperatureSensorCapability?(device: Device): TemperatureSensorCapability;
  getSpeakerCapability?(device: Device): SpeakerCapability;
  getMotionSensorCapability?(device: Device): MotionSensorCapability;
  getCameraCapability?(device: Device): CameraCapability;
  getLightSensorCapability?(device: Device): LightSensorCapability;
  getCapabilities(device: Device): Capability[];

  synchronize(): Promise<void>;
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