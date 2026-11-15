'use strict';

// Matches MAX_COMPRESSOR_MODULATION in services/ebusd/index.ts.
const MAX_COMPRESSOR_MODULATION = 82;

module.exports = {
  up: async function(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE events SET value = ROUND(value * 100 / :max, 1) WHERE type = 'compressor_modulation'",
      { replacements: { max: MAX_COMPRESSOR_MODULATION } }
    );

    await queryInterface.sequelize.query("DELETE FROM events WHERE type = 'compressor_power'");
  },

  down: async function(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE events SET value = ROUND(value * :max / 100, 1) WHERE type = 'compressor_modulation'",
      { replacements: { max: MAX_COMPRESSOR_MODULATION } }
    );
  }
};
