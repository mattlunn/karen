'use strict';

module.exports = {
  up: async function(queryInterface, Sequelize) {
    const [ id ] = await queryInterface.sequelize.query(`INSERT INTO devices (
      type,
      name,
      provider,
      providerId,
      metaStringified,
      createdAt,
      updatedAt
    ) VALUES (
      'camera',
      'Hallway Camera',
      'synology',
      '3',
      '{}',
      NOW(),
      NOW()
    )`, { type: queryInterface.sequelize.QueryTypes.INSERT });

    await queryInterface.sequelize.query(`UPDATE events SET deviceId = ${id} WHERE deviceId = "3" AND deviceType = "camera"`);
    await queryInterface.removeColumn('events', 'deviceType');
  },
  down: function(queryInterface) {
    throw new Error(`Can't revert this migration! Sorry mate.`);
  }
};