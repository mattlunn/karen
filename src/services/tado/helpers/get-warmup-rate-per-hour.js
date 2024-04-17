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

    limit: 20
  });

  const temperatures = await Event.findAll({
    where: {
      deviceId: device.id,
      type: 'temperature',

      [Op.or]: history.map(x => [
        {
          start: { [Op.lte]: x.start },
          end: { [Op.gte]: x.start }
        }, {
          start: { [Op.lte]: x.end },
          end: { [Op.gte]: x.end }
        }
      ]).flat()
    }
  });

  function findTemperateAtTime(time) {
    return temperatures.find(({ start, end }) => start <= time && end >= time).value;
  }

  const warmupRates = history.reduce((acc, { start, end }) => {
    const temperatureAtStart = findTemperateAtTime(start);
    const temperatureAtEnd = findTemperateAtTime(end);
    const durationInHours = moment(end).diff(start, 'h', true);
    
    if (durationInHours > 0.5 && temperatureAtEnd > temperatureAtStart) {
      acc.push((temperatureAtEnd - temperatureAtStart) / durationInHours);
    }

    return acc;
  }, []);

  return warmupRates.reduce((acc, curr) => acc + curr, 0) / warmupRates.length;
}