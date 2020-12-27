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
        if (this.getDataValue('suppressedAt')) {
          return this.getDataValue('suppressedAt');
        }

        const autoSuppressionTime = moment(this.startedAt).add(5, 'minutes');

        return autoSuppressionTime.isAfter(moment())
          ? null
          : autoSuppressionTime;
      }
    },

    suppressedBy: {
      type: Sequelize.INTEGER,
      allowNull: true
    },

    isSuppressed: {
      type: Sequelize.VIRTUAL,
      get() {
        return !!this.suppressedAt;
      },
      set() {
        throw new Error();
      }
    }
  });

  return alarmActivation;
}