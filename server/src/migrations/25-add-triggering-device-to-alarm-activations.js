'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    // Existing activations predate triggeringDeviceId and have no way to backfill it - drop them
    // rather than leave the column nullable.
    await queryInterface.bulkDelete('alarm_activations', {});

    await queryInterface.addColumn('alarm_activations', 'triggeringDeviceId', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
  },

  down: async function(queryInterface, Sequelize) {
    await queryInterface.removeColumn('alarm_activations', 'triggeringDeviceId');
  }
};
