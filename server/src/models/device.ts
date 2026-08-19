import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, HasManyGetAssociationsMixin, CreationOptional, NonAttribute } from 'sequelize';
import logger from '../logger';
import { Event } from './event';
import {
  Capability,
  ProviderLightCapability,
  ProviderLockCapability,
  ProviderSpeakerCapability,
  ProviderThermostatCapability,
  ProviderSwitchCapability,
  ProviderTelevisionCapability,
  ProviderElectricVehicleCapability,

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
  TelevisionCapability,
  HeatPumpCapability,
  SpeakerCapability,
  ElectricVehicleCapability,
  BinCollectionCapability,
  ButtonCapability,
  DoorbellCapability,
  AlarmSensorCapability,
  ContactSensorCapability,
  ConnectivityCapability,
  EnergyMonitorCapability,
  EnergyCostCapability
} from './capabilities';

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
  #capabilityCache: Map<string, unknown> = new Map();

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

  // Keyed by capability *and* instance, since a device can expose several
  // instances of one capability (e.g. a presence sensor reporting per zone).
  // A null instanceId addresses the singleton instance - the device itself.
  #getCapabilityOrThrow<T>(cacheKey: string, instanceId: string | null, handler: () => T): T {
    // TODO: Should check that the provider can provide this capability at this point???

    const key = `${cacheKey} ${instanceId ?? ''}`;

    if (!this.#capabilityCache.has(key)) {
      this.#capabilityCache.set(key, handler());
    }

    return this.#capabilityCache.get(key) as T;
  }

  getConnectivityCapability(instanceId: string | null = null): ConnectivityCapability {
    return this.#getCapabilityOrThrow('Connectivity', instanceId, () => new ConnectivityCapability(this, instanceId));
  }

  getBatteryLowIndicatorCapability(instanceId: string | null = null): BatteryLowIndicatorCapability {
    return this.#getCapabilityOrThrow('BatteryLowIndicator', instanceId, () => new BatteryLowIndicatorCapability(this, instanceId));
  }

  getBatteryLevelIndicatorCapability(instanceId: string | null = null): BatteryLevelIndicatorCapability {
    return this.#getCapabilityOrThrow('BatteryLevelIndicator', instanceId, () => new BatteryLevelIndicatorCapability(this, instanceId));
  }

  getLockCapability(instanceId: string | null = null): LockCapability {
    return this.#getCapabilityOrThrow('Lock', instanceId, () => new LockCapability(this, instanceId));
  }

  getLightCapability(instanceId: string | null = null): LightCapability {
    return this.#getCapabilityOrThrow('Light', instanceId, () => new LightCapability(this, instanceId));
  }

  getThermostatCapability(instanceId: string | null = null): ThermostatCapability {
    return this.#getCapabilityOrThrow('Thermostat', instanceId, () => new ThermostatCapability(this, instanceId));
  }

  getMotionSensorCapability(instanceId: string | null = null): MotionSensorCapability {
    return this.#getCapabilityOrThrow('MotionSensor', instanceId, () => new MotionSensorCapability(this, instanceId));
  }

  getTemperatureSensorCapability(instanceId: string | null = null): TemperatureSensorCapability {
    return this.#getCapabilityOrThrow('TemperatureSensor', instanceId, () => new TemperatureSensorCapability(this, instanceId));
  }

  getHeatPumpCapability(instanceId: string | null = null): HeatPumpCapability {
    return this.#getCapabilityOrThrow('HeatPump', instanceId, () => new HeatPumpCapability(this, instanceId));
  }

  getLightSensorCapability(instanceId: string | null = null): LightSensorCapability {
    return this.#getCapabilityOrThrow('LightSensor', instanceId, () => new LightSensorCapability(this, instanceId));
  }

  getHumiditySensorCapability(instanceId: string | null = null): HumiditySensorCapability {
    return this.#getCapabilityOrThrow('HumiditySensor', instanceId, () => new HumiditySensorCapability(this, instanceId));
  }

  getSpeakerCapability(instanceId: string | null = null): SpeakerCapability {
    return this.#getCapabilityOrThrow('Speaker', instanceId, () => new SpeakerCapability(this, instanceId));
  }

  getSwitchCapability(instanceId: string | null = null): SwitchCapability {
    return this.#getCapabilityOrThrow('Switch', instanceId, () => new SwitchCapability(this, instanceId));
  }

  getTelevisionCapability(instanceId: string | null = null): TelevisionCapability {
    return this.#getCapabilityOrThrow('Television', instanceId, () => new TelevisionCapability(this, instanceId));
  }

  getElectricVehicleCapability(instanceId: string | null = null): ElectricVehicleCapability {
    return this.#getCapabilityOrThrow('ElectricVehicle', instanceId, () => new ElectricVehicleCapability(this, instanceId));
  }

  getBinCollectionCapability(instanceId: string | null = null): BinCollectionCapability {
    return this.#getCapabilityOrThrow('BinCollection', instanceId, () => new BinCollectionCapability(this, instanceId));
  }

  getButtonCapability(instanceId: string | null = null): ButtonCapability {
    return this.#getCapabilityOrThrow('Button', instanceId, () => new ButtonCapability(this, instanceId));
  }

  getDoorbellCapability(instanceId: string | null = null): DoorbellCapability {
    return this.#getCapabilityOrThrow('Doorbell', instanceId, () => new DoorbellCapability(this, instanceId));
  }

  getAlarmSensorCapability(instanceId: string | null = null): AlarmSensorCapability {
    return this.#getCapabilityOrThrow('AlarmSensor', instanceId, () => new AlarmSensorCapability(this, instanceId));
  }

  getContactSensorCapability(instanceId: string | null = null): ContactSensorCapability {
    return this.#getCapabilityOrThrow('ContactSensor', instanceId, () => new ContactSensorCapability(this, instanceId));
  }

  getEnergyMonitorCapability(instanceId: string | null = null): EnergyMonitorCapability {
    return this.#getCapabilityOrThrow('EnergyMonitor', instanceId, () => new EnergyMonitorCapability(this, instanceId));
  }

  getEnergyCostCapability(instanceId: string | null = null): EnergyCostCapability {
    return this.#getCapabilityOrThrow('EnergyCost', instanceId, () => new EnergyCostCapability(this, instanceId));
  }

  getCapabilities(): Capability[] {
    const provider = Device._providers.get(this.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${this.provider} does not exist for device ${this.id} (${this.name})`);
    }

    return provider.getCapabilities(this);
  }

  /**
   * The instances of a capability this device exposes. Providers that don't
   * implement `getCapabilityInstances` describe a device with exactly one,
   * unnamed instance of each capability - which is every provider today.
   *
   * Instance ids share one namespace across the device, so a provider
   * returning the same id for two capabilities is what links them (e.g. a
   * dual plug's `SWITCH` and `ENERGY_MONITOR` both reporting `plug1`).
   */
  getCapabilityInstances(capability: Capability): CapabilityInstance[] {
    const provider = Device._providers.get(this.provider);

    if (provider === undefined) {
      throw new Error(`Provider ${this.provider} does not exist for device ${this.id} (${this.name})`);
    }

    return provider.getCapabilityInstances?.(this, capability) ?? [{ id: null, name: null }];
  }

  async getLatestEvent(type: string, instanceId: string | null = null): Promise<Event | null> {
    return Event.getLatestForDevice(this.id, type, instanceId);
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

  static async findByIdOrError(id: string) {
    const device = await this.findById(id);

    if (device === null) {
      throw new Error(`Device ${id} not found`);
    }

    return device;
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

/**
 * One instance of a capability on a device. A null id means the singleton
 * instance - the device itself - and is what every provider gets by default.
 */
export type CapabilityInstance = {
  id: string | null;
  name: string | null;
};

type ProviderHandler = {
  provideLightCapability?(): ProviderLightCapability;
  provideLockCapability?(): ProviderLockCapability;
  provideThermostatCapability?(): ProviderThermostatCapability;
  provideSwitchCapability?(): ProviderSwitchCapability;
  provideTelevisionCapability?(): ProviderTelevisionCapability;
  provideSpeakerCapability?(): ProviderSpeakerCapability;
  provideElectricVehicleCapability?(): ProviderElectricVehicleCapability;

  getCapabilities(device: Device): Capability[];

  // Optional: only providers with multi-instance hardware implement this.
  // Keyed by capability so a device can expose instances for some capabilities
  // while staying singleton for others (e.g. per-zone MOTION_SENSOR, but one
  // device-level CONNECTIVITY).
  getCapabilityInstances?(device: Device, capability: Capability): CapabilityInstance[];

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
      type: DataTypes.DATE,
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
      type: DataTypes.TEXT,
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