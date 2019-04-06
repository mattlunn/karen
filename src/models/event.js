import Sequelize from 'sequelize';

export default function (sequelize) {
  return sequelize.define('event', {
    deviceType: {
      type: Sequelize.STRING,
      allowNull: false
    },

    deviceId: {
      type: Sequelize.INTEGER,
      allowNull: false
    },

    start: {
      type: Sequelize.DATE,
      allowNull: false
    },

    end: {
      type: Sequelize.DATE,
      allowNull: true
    },

    type: {
      type: Sequelize.STRING,
      allowNull: false
    },

    value: {
      type: Sequelize.FLOAT,
      allowNull: true
    }
  });
};