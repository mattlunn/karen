'use strict';

const NEW_INDEX = 'events_deviceId_type_instanceId_start';
const REPLACED_INDEXES = {
  events_deviceId_type_start: ['deviceId', 'type', { name: 'start', order: 'DESC' }],
  events_deviceId: ['deviceId']
};

async function indexNames(queryInterface) {
  return (await queryInterface.showIndex('events')).map(index => index.name);
}

module.exports = {
  up: async function(queryInterface) {
    const existing = await indexNames(queryInterface);

    if (!existing.includes(NEW_INDEX)) {
      await queryInterface.addIndex('events', {
        name: NEW_INDEX,
        fields: ['deviceId', 'type', 'instanceId', { name: 'start', order: 'DESC' }]
      });
    }

    for (const name of Object.keys(REPLACED_INDEXES)) {
      if (existing.includes(name)) {
        await queryInterface.removeIndex('events', name);
      }
    }
  },

  down: async function(queryInterface) {
    const existing = await indexNames(queryInterface);

    for (const [name, fields] of Object.entries(REPLACED_INDEXES)) {
      if (!existing.includes(name)) {
        await queryInterface.addIndex('events', { name, fields });
      }
    }

    if (existing.includes(NEW_INDEX)) {
      await queryInterface.removeIndex('events', NEW_INDEX);
    }
  }
};
