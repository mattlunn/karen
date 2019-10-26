import Sequelize from 'sequelize';
import bus, { EVENT_START, EVENT_END } from '../bus';

export default function (sequelize) {
  const event = sequelize.define('event', {
    deviceId: {
      type: Sequelize.INTEGER,
      allowNull: false
    },

    start: {
      type: Sequelize.DATE,
      allowNull: false
    },

    end: {
      type: Sequelize.DATE,
      allowNull: true
    },

    type: {
      type: Sequelize.STRING,
      allowNull: false
    },

    value: {
      type: Sequelize.FLOAT,
      allowNull: true
    }
  });

  event.getHeatingHistoryForThermostat = async function (id, start, end) {
    const data = await this.findAll({
      where: {
        start: {
          $gte: start,
          $lt: end
        },
        end: {
          $or: [{
            $gte: start,
            $lt: end
          }, {
            $eq: null
          }]
        },
        deviceId: id,
        type: 'heating'
      },

      order: ['start']
    });

    return data.map((row) => ({
      start: Math.max(row.start, start),
      end: Math.min(row.end, end)
    }));
  };

  event.addHook('afterSave',  (event) => {
    bus.emit(event.end ? EVENT_END : EVENT_START, event);
    console.log(`${event.end ? EVENT_END : EVENT_START} called on Event ${event.id}`);
  });

  return event;
};