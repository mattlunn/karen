import { Device } from '../../models';
import getSunriseAndSunset from '../../helpers/sun';
import moment from 'moment';

// "from" or "to" can be;
// - "sunrise", "sunset"
// - "sunrise + 1h30m 27s"
// - "00:00"

function normalizeDuration(offset) {
  const duration = moment.duration();

  // period === ["1h", "30m"]
  for (const period of offset.match(/\d+ *[a-zA-Z]/g)) {
    // [num, amount] === ["1", "h"]
    const [, num, amount] = period.match(/(\d+)(\w+)/);

    duration.add(+num, amount);
  }

  return duration;
}

function normalizeTime(time) {
  if (time.includes('sunrise') || time.includes('sunset')) {
    const sunEvents = getSunriseAndSunset();
    const [sunEvent, direction, offset] = time.split(/ *([+-]) */);
    const timeOfSunEvent = moment(sunEvents[sunEvent]);

    // offset === "1h30m"
    if (offset) {
      timeOfSunEvent[direction === '+' ? 'add' : 'subtract'](normalizeDuration(offset));
    }

    return timeOfSunEvent;
  } else {
    return moment(time, 'HH:mm');
  }
}

function isWithinTime(betweens) {
  return betweens.some(({ from, until }) => normalizeTime(from).isBefore(Date.now()) && normalizeTime(until).isAfter(Date.now()));
}

export default async function (event, { between, lightName }) {
  const light = await Device.findByName(lightName);

  if (isWithinTime(between)) {
    const shouldBeOn = !event.end;

    if (shouldBeOn !== await light.getProperty('on')) {
      await light.setProperty('on', shouldBeOn);
    }
  }
}