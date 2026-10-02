'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.changeColumn('devices', 'providerId', {
      type: Sequelize.STRING,
      allowNull: false
    });

    await queryInterface.changeColumn('recordings', 'size', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false
    });
  },

  down: async function(queryInterface, Sequelize) {
    await queryInterface.changeColumn('devices', 'providerId', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.changeColumn('recordings', 'size', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true
    });
  }
};
