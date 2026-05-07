'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    const [[{ invalid }]] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS invalid FROM events WHERE deviceId NOT REGEXP '^[0-9]+$'"
    );

    if (Number(invalid) > 0) {
      throw new Error(`Cannot migrate events.deviceId to INT: ${invalid} row(s) contain non-numeric values`);
    }

    await queryInterface.changeColumn('events', 'deviceId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },

  down: async function(queryInterface, Sequelize) {
    await queryInterface.changeColumn('events', 'deviceId', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  }
};
