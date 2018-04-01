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
    }
  }, {
    tableName: 'heating'
  });

  heating.getDailyHeatMap = async function () {
    const [
      data,
      lastStatus
    ] = await Promise.all([
      this.findAll({
        where: {
          createdAt: {
            $gt: moment().startOf('day')
          }
        }
      }),

      this.findOne({
        where: {
          createdAt: {
            $lt: moment().startOf('day')
          }
        },

        order: [['createdAt', 'desc']]
      })
    ]);

    const dataForHeatChange = [];

    if (lastStatus.heating) {
      dataForHeatChange.push({
        start: moment().startOf('day')
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
      dataForHeatChange[0].end = moment();
    }

    return dataForHeatChange.reverse();
  };

  return heating;
};