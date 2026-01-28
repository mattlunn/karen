import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, HasOneGetAssociationMixin, CreationOptional } from 'sequelize';
import { Recording } from './recording';
import { Device } from './device';

export class Event extends Model<InferAttributes<Event>, InferCreationAttributes<Event>> {
  declare public id: CreationOptional<number>;
  declare public deviceId: number;
  declare public start: Date;
  declare public end: Date | null;
  declare public lastReported: Date;
  declare public type: string;
  declare public value: CreationOptional<number>;

  declare getRecording: HasOneGetAssociationMixin<Recording>;
  declare getDevice: HasOneGetAssociationMixin<Device>;

  // Cache: Map<deviceId, Map<type, Event | null>>
  static latestEventCache = new Map<number, Map<string, Event | null>>();

  /**
   * Get the latest event for a device/type combination.
   * Returns from cache if available, otherwise queries DB once to populate.
   */
  static async getLatestForDevice(deviceId: number, type: string): Promise<Event | null> {
    if (!this.latestEventCache.has(deviceId)) {
      this.latestEventCache.set(deviceId, new Map());
    }

    const deviceCache = this.latestEventCache.get(deviceId)!;

    // If we have a cache entry (even if null), return it
    if (deviceCache.has(type)) {
      return deviceCache.get(type)!;
    }

    // First access: query DB to populate cache
    const latestEvent = await Event.findOne({
      where: { deviceId, type },
      order: [['start', 'DESC']]
    });

    deviceCache.set(type, latestEvent);
    return latestEvent;
  }

  /**
   * Update cache entry. Called automatically by afterSave hook.
   */
  static updateCache(event: Event): void {
    if (!this.latestEventCache.has(event.deviceId)) {
      this.latestEventCache.set(event.deviceId, new Map());
    }

    const deviceCache = this.latestEventCache.get(event.deviceId)!;
    const currentCached = deviceCache.get(event.type);

    // Update cache if this event is newer than cached, or no cache exists
    if (!currentCached || event.start >= currentCached.start) {
      deviceCache.set(event.type, event);
    }
  }
}

export default function (sequelize: Sequelize) {
  Event.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    deviceId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    start: {
      type: DataTypes.DATE,
      allowNull: false
    },

    end: {
      type: DataTypes.DATE,
      allowNull: true
    },

    lastReported: {
      type: DataTypes.DATE,
      allowNull: false
    },

    type: {
      type: DataTypes.STRING,
      allowNull: false
    },

    value: {
      type: DataTypes.FLOAT,
      allowNull: true
    }
  }, {
    sequelize: sequelize,
    modelName: 'event',
    hooks: {
      afterSave: (event: Event) => {
        Event.updateCache(event);
      }
    }
  });
}

export class BooleanEvent {
  protected event: Event;

  public value: boolean;
  public start: Date;
  public end: Date | null;
  public lastReported: Date;

  constructor(e: Event) {
    this.event = e;
    this.value = !!e.value;
    this.start = e.start;
    this.end = e.end;
    this.lastReported = e.lastReported;
  }

  hasEnded() {
    return !!this.event.end;
  }

  getDevice() {
    return this.event.getDevice();
  }
}

export class NumericEvent {
  protected event: Event;

  public value: number;
  public start: Date;
  public end: Date | null;
  public lastReported: Date;

  constructor(e: Event) {
    this.event = e;
    this.value = e.value;
    this.start = e.start;
    this.end = e.end;
    this.lastReported = e.lastReported;
  }

  getDevice() {
    return this.event.getDevice();
  }
}