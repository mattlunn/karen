import { Event } from '../../../models';
import moment from 'moment';

export default async function getWarmupRatePerHour(device) {
  const history = await Event.findAll({
    where: {
      deviceId: device.id,
      type: 'power',
      end: {
        $ne: null
      },
      value: 100
    },

    order: [
      ['end', 'DESC']
    ],

    limit: 10
  });

  const temperatures = await Event.findAll({
    where: {
      deviceId: device.id,
      type: 'temperature',

      $or: history.map(x => [
        {
          start: { $lte: x.start },
          end: { $gt: x.start }
        }, {
          start: { $lte: x.end },
          end: { $gt: x.end }
        }
      ]).flat()
    }
  });

  function findTemperateAtTime(time) {
    return temperatures.find(({ start, end }) => start <= time && end > time).value;
  }

  return history.reduce((acc, { start, end }) => {
    return acc + ((findTemperateAtTime(end) - findTemperateAtTime(start)) / moment(end).diff(start, 'h', true));
  }, 0) / history.length;
}