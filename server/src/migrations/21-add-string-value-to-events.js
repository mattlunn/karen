'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.addColumn('events', 'stringValue', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  down: async function(queryInterface, Sequelize) {
    await queryInterface.removeColumn('events', 'stringValue');
  }
};
