'use strict';
module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.removeColumn('stays', 'etaSentToNestAt');
    await queryInterface.removeColumn('stays', 'arrivalSentToNestAt');
    await queryInterface.removeColumn('stays', 'departureSentToNestAt');
    await queryInterface.addColumn('stays', 'arrivalTrigger', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },
  down: async function(queryInterface, Sequelize) {
    await queryInterface.addColumn('stays', 'etaSentToNestAt', {
      type: Sequelize.DATE
    });

    await queryInterface.addColumn('stays', 'arrivalSentToNestAt', {
      type: Sequelize.DATE
    });

    await queryInterface.addColumn('stays', 'departureSentToNestAt', {
      type: Sequelize.DATE
    });

    await queryInterface.removeColumn('stays', 'arrivalTrigger');
  }
};