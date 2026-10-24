'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    await queryInterface.createTable('logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      severity: {
        allowNull: false,
        type: Sequelize.ENUM(['info', 'notice', 'warning', 'critical'])
      },
      message: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      audience: {
        allowNull: false,
        type: Sequelize.ENUM(['admins', 'all', 'absent', 'user'])
      },
      userId: {
        allowNull: true,
        type: Sequelize.INTEGER,
        references: { model: 'users', key: 'id' }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE(3)
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE(3)
      }
    }, {
      // Messages carry emoji, which latin1 (the default for every other table) can't store.
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    await queryInterface.createTable('log_devices', {
      logId: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        references: { model: 'logs', key: 'id' },
        onDelete: 'CASCADE'
      },
      deviceId: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
        references: { model: 'devices', key: 'id' },
        onDelete: 'CASCADE'
      }
    });

    await queryInterface.addIndex('log_devices', {
      name: 'log_devices_deviceId_logId',
      fields: ['deviceId', 'logId']
    });
  },

  down: async function(queryInterface) {
    await queryInterface.dropTable('log_devices');
    await queryInterface.dropTable('logs');
  }
};
