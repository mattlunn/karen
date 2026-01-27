'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.removeColumn('devices', 'type');
    await queryInterface.addColumn('devices', 'manufacturer', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'Unknown'
    });
    await queryInterface.addColumn('devices', 'model', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'Unknown'
    });
  },
  down: async function(queryInterface, Sequelize) {
    await queryInterface.removeColumn('devices', 'manufacturer');
    await queryInterface.removeColumn('devices', 'model');
    await queryInterface.addColumn('devices', 'type', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
