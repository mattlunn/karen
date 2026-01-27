'use strict';

module.exports = {
  up: function(queryInterface) {
    return queryInterface.removeColumn('devices', 'type');
  },
  down: function(queryInterface, Sequelize) {
    return queryInterface.addColumn('devices', 'type', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
