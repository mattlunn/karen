'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.createTable('rooms', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      displayWeight: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      displayIconName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }).then(() => {
      return queryInterface.addColumn('devices', 'roomId', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    });
  },
  down: function(queryInterface) {
    return queryInterface.dropTable('rooms').then(() => {
      return queryInterface.removeColumn('devices', 'roomId');
    });
  }
};