'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.renameColumn('events', 'cameraId', 'deviceId').then(() => {
      return queryInterface.renameColumn('events', 'timestamp', 'start');
    }).then(() => {
      return queryInterface.addColumn('events', 'end', {
        type: Sequelize.DATE,
        allowNull: true,
        after: 'start'
      });
    }).then(() => {
      return queryInterface.addColumn('events', 'deviceType', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'camera',
        after: 'id'
      });
    }).then(() => {
      return queryInterface.addColumn('events', 'value', {
        type: Sequelize.FLOAT,
        allowNull: true,
        after: 'type'
      });
    }).then(() => {
      return queryInterface.changeColumn('events', 'type', {
        type: Sequelize.STRING,
        allowNull: false
      });
    });
  },
  down: function(queryInterface, Sequelize) {
    return queryInterface.renameColumn('events', 'deviceId', 'cameraId').then(() => {
      return queryInterface.renameColumn('events', 'start', 'timestamp')
    }).then(() => {
      return queryInterface.removeColumn('events', 'end');
    }).then(() => {
      return queryInterface.removeColumn('events', 'deviceType');
    }).then(() => {
      return queryInterface.removeColumn('events', 'value');
    }).then(() => {
      return queryInterface.changeColumn('events', 'type', {
        type: Sequelize.ENUM('motion', 'disconnection', 'connection'),
        allowNull: false
      });
    });
  }
};