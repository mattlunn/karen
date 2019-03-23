import Sequelize from 'sequelize';
import moment from 'moment';

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
    },
    thermostatId: {
      type: Sequelize.STRING,
      allowNull: false
    }
  }, {
    tableName: 'heating'
  });

  heating.getHeatingHistoryForThermostat = async function (id, start, end) {
    const [
      data,
      lastStatus
    ] = await Promise.all([
      this.findAll({
        where: {
          createdAt: {
            $gte: start,
            $lt: end
          },
          thermostatId: id
        }
      }),

      this.findOne({
        where: {
          createdAt: {
            $lte: start
          },
          thermostatId: id
        },

        order: [['createdAt', 'desc']]
      })
    ]);

    const dataForHeatChange = [];

    if (lastStatus && lastStatus.heating) {
      dataForHeatChange.push({
        start: start
      });
    }

    for (const datum of data) {
      if (datum.heating && (!dataForHeatChange.length || dataForHeatChange[0].end)) {
        dataForHeatChange.unshift({
          start: datum.createdAt
        });
      } else if (!datum.heating && dataForHeatChange.length && !dataForHeatChange[0].end) {
        dataForHeatChange[0].end = datum.createdAt;
      }
    }

    if (dataForHeatChange.length && !dataForHeatChange[0].end) {
      dataForHeatChange[0].end = end;
    }

    return dataForHeatChange.reverse();
  };

  return heating;
};