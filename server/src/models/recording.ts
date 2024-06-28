import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, NonAttribute, CreationOptional } from 'sequelize';
import { Event } from './event';

export class Recording extends Model<InferAttributes<Recording>, InferCreationAttributes<Recording>> {
  declare public id: CreationOptional<number>;
  declare public eventId: number;
  declare public recording: string;
  declare public start: Date;
  declare public end: CreationOptional<Date>;
  declare public size: CreationOptional<number>;

  declare public event: NonAttribute<Event>;
}

export default function (sequelize: Sequelize) {
  Recording.init({
    id: {
      type: DataTypes.NUMBER,
      allowNull: false,
      unique: true,
      primaryKey: true
    },

    eventId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    recording: {
      type: DataTypes.STRING,
      allowNull: false
    },

    start: {
      type: DataTypes.DATE,
      allowNull: false
    },

    end: {
      type: DataTypes.DATE,
      allowNull: false
    },

    size: {
      type: DataTypes.INTEGER.UNSIGNED
    }
  }, {
    sequelize,
    tableName: 'recordings'
  });

  return Recording;
}