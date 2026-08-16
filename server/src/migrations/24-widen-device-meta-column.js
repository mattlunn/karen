'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.changeColumn('devices', 'metaStringified', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async function(queryInterface, Sequelize) {
    await queryInterface.changeColumn('devices', 'metaStringified', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
