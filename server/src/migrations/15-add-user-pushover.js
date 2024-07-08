'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.addColumn('users', 'pushoverToken', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },
  down: function(queryInterface) {
    return queryInterface.removeColumn('users', 'pushoverToken');
  }
};