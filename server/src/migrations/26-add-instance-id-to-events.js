'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.addColumn('events', 'instanceId', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
  },

  down: async function(queryInterface, Sequelize) {
    await queryInterface.removeColumn('events', 'instanceId');
  }
};
