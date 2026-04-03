'use strict';
module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.ENUM('full', 'guest'),
      allowNull: false,
      defaultValue: 'full'
    });
    await queryInterface.addColumn('users', 'code', {
      type: Sequelize.STRING(6),
      allowNull: true
    });
    await queryInterface.addColumn('users', 'validFrom', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
    await queryInterface.addColumn('users', 'validTo', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
    await queryInterface.addColumn('users', 'schedule', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },

  down: async function(queryInterface) {
    await queryInterface.removeColumn('users', 'schedule');
    await queryInterface.removeColumn('users', 'validTo');
    await queryInterface.removeColumn('users', 'validFrom');
    await queryInterface.removeColumn('users', 'code');
    await queryInterface.removeColumn('users', 'role');
  }
};
