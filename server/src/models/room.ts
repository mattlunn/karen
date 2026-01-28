import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Room extends Model<InferAttributes<Room>, InferCreationAttributes<Room>> {
  declare public id: CreationOptional<number>;
  declare public createdAt: CreationOptional<Date>;
  declare public updatedAt: CreationOptional<Date>;

  declare public name: string;

  declare public displayWeight: CreationOptional<number>;
  declare public displayIconName: CreationOptional<string>;
}

export default function (sequelize: Sequelize) {
  Room.init({
    id: {
      type: DataTypes.NUMBER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      unique: true
    },
    createdAt: {
      type: DataTypes.DATE
    },
    updatedAt: {
      type: DataTypes.DATE
    },
    name: {
      type: DataTypes.STRING,
      unique: true
    },
    displayWeight: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    displayIconName: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    modelName: 'room',
    sequelize
  });
}