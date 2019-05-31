import Sequelize from 'sequelize';
import bus, { EVENT_START, EVENT_END } from '../bus';

export default function (sequelize) {
  const event = sequelize.define('event', {
    deviceType: {
      type: Sequelize.STRING,
      allowNull: false
    },

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
          $gte: start,
          $lt: end
        },
        deviceId: id,
        deviceType: 'thermostat',
        type: 'heating'
      },

      order: ['start']
    });

    return data.map((row) => ({
      start: Math.max(row.start, start),
      end: Math.min(row.end, end)
    }));
  };

  event.addHook('afterCreate',  (event) => {
    console.log('afterCreate called on Event');

    bus.emit(EVENT_START, event);
  });

  event.addHook('afterSave',  (event) => {
    console.log('afterSave called on Event');

    bus.emit(EVENT_END, event);
  });

  return event;
};