import { Event, Op } from '../../../models';
import moment from 'moment';

export default async function getWarmupRatePerHour(device) {
  const history = await Event.findAll({
    where: {
      deviceId: device.id,
      type: 'power',
      end: {
        [Op.ne]: null
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

      [Op.or]: history.map(x => [
        {
          start: { [Op.lte]: x.start },
          end: { [Op.gt]: x.start }
        }, {
          start: { [Op.lte]: x.end },
          end: { [Op.gt]: x.end }
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