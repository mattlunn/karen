import Sequelize from 'sequelize';

export default function (sequelize) {
  const heating = sequelize.define('heating', {
    humidity: {
      type: Sequelize.FLOAT,
      allowNull: false
    },
    target: {
      type: Sequelize.FLOAT,
      allowNull: true
    },
    current: {
      type: Sequelize.FLOAT,
      allowNull: false
    },
    heating: {
      type: Sequelize.BOOLEAN,
      allowNull: false
    },
    home: {
      type: Sequelize.BOOLEAN,
      allowNull: false
    }
  }, {
    tableName: 'heating'
  });

  return heating;
};