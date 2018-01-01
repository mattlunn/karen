'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('stays').then(() =>
      queryInterface.addColumn('stays', 'userId', {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        },
        allowNull: false
      })
    );
  },
  down: function(queryInterface) {
    return queryInterface.removeColumn('stays', 'userId');
  }
};