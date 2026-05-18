'use strict';

const MODE_NAMES = {
  0: 'UNKNOWN',
  1: 'STANDBY',
  2: 'HEATING',
  3: 'DHW',
  4: 'DEICING',
  5: 'FROST_PROTECTION'
};

module.exports = {
  up: async function(queryInterface, Sequelize) {
    for (const [numeric, name] of Object.entries(MODE_NAMES)) {
      await queryInterface.sequelize.query(
        "UPDATE events SET stringValue = :name, value = NULL WHERE type = 'mode' AND value = :numeric",
        { replacements: { numeric: Number(numeric), name } }
      );
    }
  },

  down: async function(queryInterface, Sequelize) {
    for (const [numeric, name] of Object.entries(MODE_NAMES)) {
      await queryInterface.sequelize.query(
        "UPDATE events SET value = :numeric, stringValue = NULL WHERE type = 'mode' AND stringValue = :name",
        { replacements: { numeric: Number(numeric), name } }
      );
    }
  }
};
