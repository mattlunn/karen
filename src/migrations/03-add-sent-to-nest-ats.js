'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.addColumn('stays', 'arrivalSentToNestAt', Sequelize.DATE)
      .then(queryInterface.addColumn('stays', 'departureSentToNestAt', Sequelize.DATE));
  },
  down: function(queryInterface) {
    return queryInterface.removeColumn('stays', 'arrivalSentToNestAt')
      .then(queryInterface.removeColumn('stays', 'departureSentToNestAt'));
  }
};