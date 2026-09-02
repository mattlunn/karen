'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.addColumn('alarm_activations', 'suppressFurtherAlertsUntil', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.sequelize.query(
      'UPDATE alarm_activations SET suppressFurtherAlertsUntil = COALESCE(suppressedAt, startedAt + INTERVAL 5 MINUTE)'
    );

    await queryInterface.changeColumn('alarm_activations', 'suppressFurtherAlertsUntil', {
      type: Sequelize.DATE,
      allowNull: false
    });

    await queryInterface.removeColumn('alarm_activations', 'suppressedAt');
    await queryInterface.removeColumn('alarm_activations', 'suppressedBy');
  },

  down: async function(queryInterface, Sequelize) {
    await queryInterface.addColumn('alarm_activations', 'suppressedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('alarm_activations', 'suppressedBy', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.sequelize.query(
      'UPDATE alarm_activations SET suppressedAt = suppressFurtherAlertsUntil'
    );

    await queryInterface.removeColumn('alarm_activations', 'suppressFurtherAlertsUntil');
  }
};
