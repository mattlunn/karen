'use strict';
module.exports = {
  up: async function(queryInterface, Sequelize) {
    // 1. Add column as nullable first (can't add NOT NULL to existing rows)
    await queryInterface.addColumn('events', 'lastReported', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // 2. Backfill all existing events with lastReported = start
    await queryInterface.sequelize.query(
      'UPDATE events SET lastReported = start'
    );

    // 3. Now make it NOT NULL
    await queryInterface.changeColumn('events', 'lastReported', {
      type: Sequelize.DATE,
      allowNull: false,
    });
  },

  down: async function(queryInterface) {
    await queryInterface.removeColumn('events', 'lastReported');
  }
};
