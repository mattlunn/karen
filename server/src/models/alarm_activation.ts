import { Sequelize, DataTypes, Model, InferAttributes, InferCreationAttributes, HasManyGetAssociationsMixin, CreationOptional, NonAttribute, HasOneGetAssociationMixin } from 'sequelize';
import dayjs from '../dayjs';
import { Arming } from './arming';

export class AlarmActivation extends Model<InferAttributes<AlarmActivation>, InferCreationAttributes<AlarmActivation>> {
  declare id: CreationOptional<number>;
  declare armingId: CreationOptional<number>;
  declare startedAt: CreationOptional<Date>;
  declare suppressedAt: CreationOptional<Date>;
  declare suppressedBy: CreationOptional<number>;
  declare isSuppressed: CreationOptional<boolean>;

  declare getArming: HasOneGetAssociationMixin<Arming>;
};

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

    suppressedAt: {
      type: DataTypes.DATE,
      allowNull: true,

      get() {
        if (this.getDataValue('suppressedAt')) {
          return this.getDataValue('suppressedAt');
        }

        const autoSuppressionTime = dayjs(this.startedAt).add(5, 'minutes');

        return autoSuppressionTime.isAfter(dayjs())
          ? null
          : autoSuppressionTime;
      }
    },

    suppressedBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    isSuppressed: {
      type: DataTypes.VIRTUAL,
      get() {
        return !!this.suppressedAt;
      },
      set() {
        throw new Error();
      }
    }
  }, {
    sequelize,
    modelName: 'alarm_activation'
  });
}