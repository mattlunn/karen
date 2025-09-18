import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, HasOneGetAssociationMixin, CreationOptional } from 'sequelize';
import { Recording } from './recording';
import { Device } from './device';

export class Event extends Model<InferAttributes<Event>, InferCreationAttributes<Event>> {
  declare public id: CreationOptional<number>;
  declare public deviceId: number;
  declare public start: Date;
  declare public end: CreationOptional<Date>;
  declare public type: string;
  declare public value: CreationOptional<number>;

  declare getRecording: HasOneGetAssociationMixin<Recording>;
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
      type: DataTypes.DATE,
      allowNull: false
    },

    end: {
      type: DataTypes.DATE,
      allowNull: true
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
    modelName: 'event'
  });
}

export class BooleanEvent {
  protected event: Event;

  public value: boolean;
  public start: Date;
  public end?: Date;

  constructor(e: Event) {
    this.event = e;
    this.value = !!e.value;
    this.start = e.start;
    this.end = e.end;
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
  public end?: Date;

  constructor(e: Event) {
    this.event = e;
    this.value = e.value;
    this.start = e.start;
    this.end = e.end;
  }

  getDevice() {
    return this.event.getDevice();
  }
}