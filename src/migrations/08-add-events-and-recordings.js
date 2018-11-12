'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.createTable('events', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      cameraId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },

      timestamp: {
        type: Sequelize.DATE,
        allowNull: false
      },

      type: {
        type: Sequelize.ENUM('motion', 'disconnection', 'connection')
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
      return queryInterface.createTable('recordings', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        eventId: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        recording: {
          type: Sequelize.STRING,
          allowNull: false
        },
        start: {
          type: Sequelize.DATE,
          allowNull: false
        },
        end: {
          type: Sequelize.DATE,
          allowNull: false
        },
        size: {
          type: Sequelize.INTEGER.UNSIGNED
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
    });
  },
  down: function(queryInterface) {
    return queryInterface.dropTable('events').then(() => {
      return queryInterface.dropTable('recordings');
    });
  }
};