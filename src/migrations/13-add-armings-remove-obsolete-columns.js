'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.createTable('armings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      start: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end: {
        type: Sequelize.DATE,
        allowNull: true
      },
    });

    await queryInterface.removeColumn('stays', 'etaSentToNestAt');
    await queryInterface.removeColumn('stays', 'arrivalSentToNestAt');
    await queryInterface.removeColumn('stays', 'departureSentToNestAt');
  },
  down: async function(queryInterface, Sequelize) {
    await queryInterface.dropTable('armings');
    await queryInterface.addColumn('stays', 'etaSentToNestAt', Sequelize.DATE);
    await queryInterface.addColumn('stays', 'arrivalSentToNestAt', Sequelize.DATE);
    await queryInterface.addColumn('stays', 'departureSentToNestAt', Sequelize.DATE);
  }
};