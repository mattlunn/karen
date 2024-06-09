'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.addColumn('users', 'device', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },
  down: function(queryInterface) {
    return queryInterface.removeColumn('users', 'device');
  }
};