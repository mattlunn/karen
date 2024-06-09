'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.createTable('heating', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      humidity: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      target: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      current: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      heating: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      home: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: function(queryInterface) {
    return queryInterface.dropTable('heating');
  }
};