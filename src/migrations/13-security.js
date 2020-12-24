'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.createTable('armings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      start: {
        allowNull: false,
        type: Sequelize.DATE
      },
      end: {
        allowNull: true,
        type: Sequelize.DATE
      },
      mode: {
        allowNull: false,
        type: Sequelize.ENUM(['NIGHT', 'AWAY'])
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
      return queryInterface.createTable('alarm_activation', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        armingId: {
          allowNull: false,
          type: Sequelize.INTEGER
        },
        startedAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        suppressedAt: {
          allowNull: true,
          type: Sequelize.DATE
        },
        suppressedBy: {
          allowNull: true,
          type: Sequelize.INTEGER
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
    }).then(() => {
      return queryInterface.addColumn('users', 'mobileNumber', {
        type: Sequelize.STRING,
        allowNull: true
      });
    });
  },
  down: function(queryInterface) {
    return queryInterface.dropTable('armings').then(() => {
      return queryInterface.dropTable('alarm_activation');
    }).then(() => {
      return queryInterface.removeColumn('users', 'mobileNumber');
    });
  }
};