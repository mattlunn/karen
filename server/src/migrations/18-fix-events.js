'use strict';
module.exports = {
  up: async function(queryInterface, Sequelize) {
    let offset = 0;
    let fixedRows = 0;

    do {
      const invalidEvents = await queryInterface.sequelize.query(`SELECT id, start, type, deviceId FROM events WHERE end IS NULL LIMIT 1000 OFFSET ${offset}`, {
        type: Sequelize.QueryTypes.SELECT,
      });

      if (invalidEvents.length === 0) {
        console.log('No more events with no end date; ending');
        break;
      } else {
        console.log(`${invalidEvents.length} events to process; already fixed ${fixedRows}, ${offset} unfixable`);
      }

      for (let i=0;i<invalidEvents.length;i++) {
        const { id, start, type, deviceId } = invalidEvents[i];
        const nextEvents = await queryInterface.sequelize.query(`SELECT start FROM events WHERE deviceId = '${deviceId}' AND type = '${type}' AND start > ? ORDER BY start ASC LIMIT 1`, {
          type: Sequelize.QueryTypes.SELECT,
          replacements: [start]
        });

        if (nextEvents.length === 0) {
          offset++;

          console.log(`Skipping ${id} from ${start}, as it has no later event`);
        } else {
          const [, affected] = await queryInterface.sequelize.query(`UPDATE events SET end = ? WHERE id = '${id}'`, {
            replacements: [nextEvents[0].start],
            type: Sequelize.QueryTypes.UPDATE
          });

          if (affected !== 1) {
            throw new Error(`${affected} rows affected while updating ${id}`);
          } else {
            fixedRows++;
          }
        }
      };
    } while (true);

    console.log(`Done. ${fixedRows} were fixed. ${offset} were unfixable`);
  },
  down: async function(queryInterface, Sequelize) {
  }
};