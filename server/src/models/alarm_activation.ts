import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, HasOneGetAssociationMixin, BelongsToGetAssociationMixin } from 'sequelize';
import dayjs from '../dayjs';
import { Arming } from './arming';
import { Device } from './device';

export class AlarmActivation extends Model<InferAttributes<AlarmActivation>, InferCreationAttributes<AlarmActivation>> {
  declare id: CreationOptional<number>;
  declare armingId: CreationOptional<number>;
  declare startedAt: CreationOptional<Date>;
  declare suppressFurtherAlertsUntil: Date;
  declare triggeringDeviceId: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare getArming: HasOneGetAssociationMixin<Arming>;
  declare getTriggeringDevice: BelongsToGetAssociationMixin<Device>;

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
      type: DataTypes.DATE(3),
      allowNull: false
    },

    suppressFurtherAlertsUntil: {
      type: DataTypes.DATE(3),
      allowNull: false
    },

    triggeringDeviceId: {
      type: DataTypes.INTEGER,
      allowNull: false
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
    modelName: 'alarm_activation'
  });
}
