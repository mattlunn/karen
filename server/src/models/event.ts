import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, HasOneGetAssociationMixin, CreationOptional } from 'sequelize';
import { Recording } from './recording';
import bus, { EVENT_START, EVENT_END } from '../bus';

export class Event extends Model<InferAttributes<Event>, InferCreationAttributes<Event>> {
  declare public id: CreationOptional<number>;
  declare public deviceId: number;
  declare public start: Date;
  declare public end: CreationOptional<Date>;
  declare public type: string;
  declare public value: CreationOptional<number>;

  declare getRecording: HasOneGetAssociationMixin<Recording>;
}

export default function (sequelize: Sequelize): typeof Event {
  Event.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
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
    tableName: 'events'
  });

  Event.addHook('afterSave',  (event: Event) => {
    bus.emit(event.end ? EVENT_END : EVENT_START, event);
    console.log(`${event.end ? EVENT_END : EVENT_START} called on Event ${event.id}`);
  });

  return Event;
}