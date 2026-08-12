'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.addColumn('alarm_activations', 'triggeringDeviceId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  down: async function(queryInterface, Sequelize) {
    await queryInterface.removeColumn('alarm_activations', 'triggeringDeviceId');
  }
};
