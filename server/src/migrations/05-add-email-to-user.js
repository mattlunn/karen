'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.addColumn('users', 'email', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: ''
    });
  },
  down: function(queryInterface) {
    return queryInterface.removeColumn('users', 'email');
  }
};