import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, HasOneGetAssociationMixin } from 'sequelize';
import dayjs from '../dayjs';
import { Arming } from './arming';

export class AlarmActivation extends Model<InferAttributes<AlarmActivation>, InferCreationAttributes<AlarmActivation>> {
  declare id: CreationOptional<number>;
  declare armingId: CreationOptional<number>;
  declare startedAt: CreationOptional<Date>;
  declare suppressFurtherAlertsUntil: Date;

  declare getArming: HasOneGetAssociationMixin<Arming>;

  isSuppressingFurtherAlerts(at: Date = new Date()): boolean {
    return dayjs(at).isBefore(this.suppressFurtherAlertsUntil);
  }
}

export default function (sequelize: Sequelize) {
  AlarmActivation.init({
    id: {
      type: DataTypes.NUMBER,
      allowNull: false,
      unique: true,
      primaryKey: true,
      autoIncrement: true
    },

    armingId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    startedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },

    suppressFurtherAlertsUntil: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'alarm_activation'
  });
}
