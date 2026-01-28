import { Sequelize, Op, DataTypes, Model, InferAttributes, InferCreationAttributes, HasManyGetAssociationsMixin, CreationOptional, NonAttribute } from 'sequelize';
import logger from '../logger';
import { Event } from './event';
import { 
  Capability, 
  ProviderLightCapability, 
  ProviderLockCapability, 
  ProviderSpeakerCapability, 
  ProviderThermostatCapability,
  ProviderSwitchCapability,

  LightSensorCapability, 
  HumiditySensorCapability, 
  LightCapability, 
  BatteryLevelIndicatorCapability,
  BatteryLowIndicatorCapability, 
  LockCapability, 
  MotionSensorCapability, 
  TemperatureSensorCapability,
  ThermostatCapability, 
  SwitchCapability, 
  HeatPumpCapability,
  SpeakerCapability
} from './capabilities';
import dayjs from '../dayjs';

const latestEventCache = new Map();

export class Device extends Model<InferAttributes<Device>, InferCreationAttributes<Device>> {
  declare id: CreationOptional<number>;
  declare provider: string;
  declare providerId: string;
  declare createdAt: CreationOptional<Date>;
  declare name: CreationOptional<string>;
  declare manufacturer: CreationOptional<string>;
  declare model: CreationOptional<string>;
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

  #getCapabilityOrThrow<T>(handler: () => T): T {
    // TODO: Should check that the provider can provide this capability at this point???

    if (!this.#capabilityCache.has(handler)) {
      this.#capabilityCache.set(handler, handler());
    }

    return this.#capabilityCache.get(handler) as T;
  }

  async getIsConnected(): Promise<boolean> {
    // TODO
    return true;
  }

  getBatteryLowIndicatorCapability(): BatteryLowIndicatorCapability {
    return this.#getCapabilityOrThrow(() => new BatteryLowIndicatorCapability(this));
  }

  getBatteryLevelIndicatorCapability(): BatteryLevelIndicatorCapability {
    return this.#getCapabilityOrThrow(() => new BatteryLevelIndicatorCapability(this));
  }

  getLockCapability(): LockCapability {
    return this.#getCapabilityOrThrow(() => new LockCapability(this));
  }

  getLightCapability(): LightCapability {
    return this.#getCapabilityOrThrow(() => new LightCapability(this));
  }

  getThermostatCapability(): ThermostatCapability {
    return this.#getCapabilityOrThrow(() => new ThermostatCapability(this));
  }

  getMotionSensorCapability(): MotionSensorCapability {
    return this.#getCapabilityOrThrow(() => new MotionSensorCapability(this));
  }

  getTemperatureSensorCapability(): TemperatureSensorCapability {
    return this.#getCapabilityOrThrow(() => new TemperatureSensorCapability(this));
  }

  getHeatPumpCapability(): HeatPumpCapability {
    return this.#getCapabilityOrThrow(() => new HeatPumpCapability(this));
  }

  getLightSensorCapability(): LightSensorCapability {
    return this.#getCapabilityOrThrow(() => new LightSensorCapability(this));
  }

  getHumiditySensorCapability(): HumiditySensorCapability {
    return this.#getCapabilityOrThrow(() => new HumiditySensorCapability(this));
  }

  getSpeakerCapability(): SpeakerCapability {
    return this.#getCapabilityOrThrow(() => new SpeakerCapability(this));
  }

  getSwitchCapability(): SwitchCapability {
    return this.#getCapabilityOrThrow(() => new SwitchCapability(this));
  }

  getCapabilities(): Capability[] {
    const provider = Device._providers.get(this.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${this.provider} does not exist for device ${this.id} (${this.name})`);
    }

    return provider.getCapabilities(this);
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

    if (newerLatestEvent) {
      lastLatestEvent = {
        start: newerLatestEvent.start,
        event: newerLatestEvent
      };
      
      latestEventCache.get(this.id).set(type, lastLatestEvent);
    } else if (!lastLatestEvent) {
      lastLatestEvent = {
        start: dayjs().subtract(1, 'day').toDate(), // Arbritrary 1 day ago in case a new event comes in with a slightly past timestamp (e.g. periodic sync),
        event: null
      };

      latestEventCache.get(this.id).set(type, lastLatestEvent);
    }

    return lastLatestEvent.event;
  }

  static findByName(name: string): Promise<Device | null> {
    return this.findOne({
      where: {
        name
      }
    });
  }

  static async findByNameOrError(name: string): Promise<Device> {
    const device = await this.findByName(name);

    if (device === null) {
      throw new Error(`Device with name ${name} could not be found`);
    }

    return device;
  }

  static findById(id: string) {
    return this.findOne({
      where: {
        id
      }
    });
  }

  static async findByCapability(capability: Capability) {
    const allDevices = await this.findAll();

    return allDevices.filter(x => x.getCapabilities().includes(capability));
  }

  static findByProviderId(provider: string, id: string) {
    return this.findOne({
      where: {
        provider,
        providerId: id
      }
    });
  }

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
  }

  static findByProvider(provider: string) {
    return this.findAll({
      where: {
        provider
      }
    });
  }

  static async synchronize() {
    for (const [name, { synchronize }] of Device._providers) {
      logger.info(`Synchronizing ${name}`);

      try {
        await synchronize();
      } catch (e) {
        logger.error(e, `Unable to synchronize devices for provider ${name}`);
      }
    }
  }

  static _providers = new Map<string, ProviderHandler>();

  static registerProvider(name: string, handlers: ProviderHandler) {
    this._providers.set(name, handlers);

    handlers.synchronize().catch(e => logger.error(e));
  }

  static getProviderCapabilities(provider: string): ProviderHandler {
    const providerHandler = this._providers.get(provider);

    if (providerHandler === undefined) {
      throw new Error(`Provider ${provider} does not exist`);
    }

    return providerHandler;
  }
}

type ProviderHandler = {
  provideLightCapability?(): ProviderLightCapability;
  provideLockCapability?(): ProviderLockCapability;
  provideThermostatCapability?(): ProviderThermostatCapability;
  provideSwitchCapability?(): ProviderSwitchCapability;
  provideSpeakerCapability?(): ProviderSpeakerCapability;

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

    createdAt: {
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

    manufacturer: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Unknown'
    },

    model: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Unknown'
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