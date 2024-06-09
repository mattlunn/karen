'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.addColumn('heating', 'thermostatId', Sequelize.STRING)
      .then(() => queryInterface.bulkUpdate('heating', {
        thermostatId: 'ScXStxi2u-RGVpokokaJ5VbchS43eyHe'
      }, {}));
  },
  down: function(queryInterface) {
    return queryInterface.removeColumn('stays', 'thermostat_id');
  }
};