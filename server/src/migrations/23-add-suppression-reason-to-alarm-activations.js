'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.addColumn('alarm_activations', 'suppressionReason', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },
  down: function(queryInterface) {
    return queryInterface.removeColumn('alarm_activations', 'suppressionReason');
  }
};
