import { Sequelize, Op, DataTypes, Model, InferAttributes, InferCreationAttributes, HasManyGetAssociationsMixin, CreationOptional } from 'sequelize';
import { AlarmActivation } from './alarm_activation';

export enum ArmingMode {
  NIGHT = 'NIGHT',
  AWAY = 'AWAY'
};

export class Arming extends Model<InferAttributes<Arming>, InferCreationAttributes<Arming>> {
  declare id: CreationOptional<number>;
  declare start: Date;
  declare end: CreationOptional<Date | null>;
  declare mode: CreationOptional<ArmingMode>;

  declare getAlarmActivations: HasManyGetAssociationsMixin<AlarmActivation>;

  static getActiveArming(when = new Date()) {
    return this.findOne({
      where: {
        start: {
          [Op.lte]: when
        },
        end: {
          [Op.or]: [{
            [Op.gt]: when,
          }, {
            [Op.eq]: null
          }]
        }
      }
    });
  };

  async getMostRecentActivation() {
    const activations = await this.getAlarmActivations();

    if (activations.length === 0) {
      return null;
    }

    return activations.reduce((mostRecent, curr) => {
      return mostRecent.startedAt > curr.startedAt ? mostRecent : curr;
    });
  };
};

export default function (sequelize: Sequelize) {
  Arming.init({
    id: {
      type: DataTypes.NUMBER,
      allowNull: false,
      unique: true,
      primaryKey: true,
      autoIncrement: true
    },

    start: {
      type: DataTypes.DATE,
      allowNull: false
    },

    end: {
      type: DataTypes.DATE,
      allowNull: true
    },

    mode: {
      type: DataTypes.ENUM('NIGHT', 'AWAY'),
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'arming'
  });
}