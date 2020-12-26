import Sequelize from 'sequelize';
import moment from 'moment';

export default function (sequelize) {
  const alarmActivation = sequelize.define('alarm_activation', {
    armingId: {
      type: Sequelize.INTEGER,
      allowNull: false
    },

    startedAt: {
      type: Sequelize.DATE,
      allowNull: false
    },

    suppressedAt: {
      type: Sequelize.DATE,
      allowNull: true,

      get() {
        return this.getDataValue('suppressedAt') || moment().diff(this.startedAt, 'minutes') > 5;
      }
    },

    suppressedBy: {
      type: Sequelize.INTEGER,
      allowNull: true
    },

    isSuppressed: {
      type: Sequelize.VIRTUAL,
      get() {
        return this.suppressedAt && moment(this.suppressedAt).isBefore(new Date());
      },
      set() {
        throw new Error();
      }
    }
  });

  return alarmActivation;
}