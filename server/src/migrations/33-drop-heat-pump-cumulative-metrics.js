'use strict';

module.exports = {
  up: async function(queryInterface) {
    await queryInterface.sequelize.query(
      'DELETE FROM events WHERE type IN (:types)',
      {
        replacements: {
          types: [
            'cumulative_power_day',
            'cumulative_yield_day',
            'cumulative_power_day_heating',
            'cumulative_yield_day_heating',
            'cumulative_power_day_dhw',
            'cumulative_yield_day_dhw'
          ]
        }
      }
    );
  },

  down: async function() {}
};
