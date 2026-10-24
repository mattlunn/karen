import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, HasOneGetAssociationMixin, CreationOptional } from 'sequelize';
import { Device } from './device';

export class Event extends Model<InferAttributes<Event>, InferCreationAttributes<Event>> {
  declare public id: CreationOptional<number>;
  declare public deviceId: number;
  declare public start: Date;
  declare public end: Date | null;
  declare public lastReported: Date;
  declare public type: string;
  declare public instanceId: CreationOptional<string | null>;
  declare public value: CreationOptional<number>;
  declare public stringValue: CreationOptional<string | null>;
  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  declare getDevice: HasOneGetAssociationMixin<Device>;
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
      type: DataTypes.DATE(3),
      allowNull: false
    },

    end: {
      type: DataTypes.DATE(3),
      allowNull: true,
      defaultValue: null
    },

    lastReported: {
      type: DataTypes.DATE(3),
      allowNull: false
    },

    type: {
      type: DataTypes.STRING,
      allowNull: false
    },

    instanceId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: null
    },

    value: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: null
    },

    stringValue: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null
    },

    createdAt: {
      type: DataTypes.DATE(3),
      allowNull: false
    },

    updatedAt: {
      type: DataTypes.DATE(3),
      allowNull: false
    }
  }, {
    sequelize: sequelize,
    modelName: 'event'
  });
}

export class BooleanEvent {
  protected event: Event;

  public id: number;
  public type: string;
  public value: boolean;
  public instanceId: string | null;
  public start: Date;
  public end: Date | null;
  public lastReported: Date;
  public updatedAt: Date;

  constructor(e: Event) {
    this.event = e;
    this.id = e.id;
    this.type = e.type;
    this.value = !!e.value;
    this.instanceId = e.instanceId ?? null;
    this.start = e.start;
    this.end = e.end;
    this.lastReported = e.lastReported;
    this.updatedAt = e.updatedAt;
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

  public id: number;
  public type: string;
  public value: number;
  public instanceId: string | null;
  public start: Date;
  public end: Date | null;
  public lastReported: Date;
  public updatedAt: Date;

  constructor(e: Event) {
    this.event = e;
    this.id = e.id;
    this.type = e.type;
    this.value = e.value;
    this.instanceId = e.instanceId ?? null;
    this.start = e.start;
    this.end = e.end;
    this.lastReported = e.lastReported;
    this.updatedAt = e.updatedAt;
  }

  getDevice() {
    return this.event.getDevice();
  }
}

export class StringEvent {
  protected event: Event;

  public id: number;
  public type: string;
  public value: string;
  public instanceId: string | null;
  public start: Date;
  public end: Date | null;
  public lastReported: Date;
  public updatedAt: Date;

  constructor(e: Event) {
    this.event = e;
    this.id = e.id;
    this.type = e.type;
    this.value = e.stringValue ?? '';
    this.instanceId = e.instanceId ?? null;
    this.start = e.start;
    this.end = e.end;
    this.lastReported = e.lastReported;
    this.updatedAt = e.updatedAt;
  }

  getDevice() {
    return this.event.getDevice();
  }
}