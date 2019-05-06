'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.renameColumn('events', 'cameraId', 'deviceId').then(() => {
      return queryInterface.changeColumn('events', 'deviceId', {
        type: Sequelize.STRING,
        allowNull: false
      })
    }).then(() => {
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
    }).then(() => {
      return queryInterface.sequelize.query('SELECT * FROM heating').then(([results]) => {
        const lastUpdatesContinuous = new Map([['humidity', null], ['target', null], ['current', null]]);
        const lastUpdatesDiscrete = new Map([['heating', null], ['home', null]]);
        const updates = [];

        for (const latestUpdate of results) {
          for (const key of lastUpdatesContinuous.keys()) {
            const matchingLastUpdate = lastUpdatesContinuous.get(key);

            if (matchingLastUpdate === null || matchingLastUpdate.value !== Number(latestUpdate[key])) {
              const now = new Date();

              if (matchingLastUpdate !== null) {
                matchingLastUpdate.updatedAt = now;
                matchingLastUpdate.end = latestUpdate.createdAt;
              }

              const record = {
                deviceType: 'thermostat',
                deviceId: latestUpdate.thermostatId,
                start: latestUpdate.createdAt,
                type: key,
                value: Number(latestUpdate[key]),
                createdAt: now,
                updatedAt: now
              };

              lastUpdatesContinuous.set(key, record);
              updates.push(record);
            }
          }

          for (const key of lastUpdatesDiscrete.keys()) {
            const matchingLastUpdate = lastUpdatesDiscrete.get(key);
            const now = new Date();

            if (latestUpdate[key] === 1 && matchingLastUpdate === null) {
              const record = {
                deviceType: 'thermostat',
                deviceId: latestUpdate.thermostatId,
                start: latestUpdate.createdAt,
                type: key,
                value: Number(latestUpdate[key]),
                createdAt: now,
                updatedAt: now
              };

              lastUpdatesDiscrete.set(key, record);
              updates.push(record);
            } else if (latestUpdate[key] === 0 && matchingLastUpdate !== null) {
              matchingLastUpdate.updatedAt = now;
              matchingLastUpdate.end = latestUpdate.createdAt;

              lastUpdatesDiscrete.set(key, null);
            }
          }
        }

        console.log('Inserting ' + updates.length + ' rows into events');

        return queryInterface.bulkInsert('events', updates);
      });
    });
  },
  down: function(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('events', {
      deviceType: 'thermostat'
    }).then(() => {
      return queryInterface.renameColumn('events', 'deviceId', 'cameraId');
    }).then(() => {
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
    }).then(() => {
      return queryInterface.changeColumn('events', 'cameraId', {
        type: Sequelize.INTEGER,
        allowNull: false
      });
    });
  }
};