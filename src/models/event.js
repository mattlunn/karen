import Sequelize from 'sequelize';

export default function (sequelize) {
  return sequelize.define('event', {
    cameraId: {
      type: Sequelize.INTEGER,
      allowNull: false
    },

    timestamp: {
      type: Sequelize.DATE,
      allowNull: false
    },

    type: {
      type: Sequelize.ENUM('motion', 'disconnection', 'connection')
    }
  });
};