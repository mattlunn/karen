'use strict';

// Close every open event that isn't the latest in its series at the start of the
// event that followed it, which is how filterClampAndSortHistory already reads them.

module.exports = {
  up: async function(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE events e
      JOIN (
        SELECT id, LEAD(start) OVER (PARTITION BY deviceId, type, instanceId ORDER BY start, id) AS nextStart
        FROM events
        WHERE (deviceId, type, IFNULL(instanceId, '')) IN (
          SELECT deviceId, type, IFNULL(instanceId, '')
          FROM events
          WHERE end IS NULL
          GROUP BY deviceId, type, instanceId
          HAVING COUNT(*) > 1
        )
      ) n ON n.id = e.id
      SET e.end = n.nextStart
      WHERE e.end IS NULL AND n.nextStart IS NOT NULL
    `);
  },

  down: async function() {}
};
