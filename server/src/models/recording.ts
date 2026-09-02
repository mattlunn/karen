import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, NonAttribute, CreationOptional } from 'sequelize';
import { Event } from './event';

export class Recording extends Model<InferAttributes<Recording>, InferCreationAttributes<Recording>> {
  declare public id: CreationOptional<number>;
  declare public eventId: number;
  declare public recording: string;
  declare public start: Date;
  declare public end: CreationOptional<Date>;
  declare public size: CreationOptional<number>;
  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  declare public event: NonAttribute<Event>;

  static findByEventId(eventId: number) {
    return this.findOne({ where: { eventId } });
  }
}

export default function (sequelize: Sequelize) {
  Recording.init({
    id: {
      type: DataTypes.NUMBER,
      allowNull: false,
      unique: true,
      primaryKey: true,
      autoIncrement: true
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
      type: DataTypes.DATE(3),
      allowNull: false
    },

    end: {
      type: DataTypes.DATE(3),
      allowNull: false
    },

    size: {
      type: DataTypes.INTEGER.UNSIGNED
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
    sequelize,
    modelName: 'recording'
  });
}