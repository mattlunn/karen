'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.addColumn('devices', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'updatedAt'
    });
  },
  down: function(queryInterface) {
    return queryInterface.removeColumn('devices', 'deletedAt');
  }
};