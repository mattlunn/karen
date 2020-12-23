import Sequelize, { Op } from 'sequelize';

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
      allowNull: true
    },

    suppressedBy: {
      type: Sequelize.INTEGER,
      allowNull: true
    }
  });

  return alarmActivation;
}