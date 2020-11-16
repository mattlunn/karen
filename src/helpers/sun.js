import { getTimes } from 'suncalc';
import { location } from '../config';
import moment from 'moment';

export default function(date) {
  // Due to https://github.com/mourner/suncalc/issues/107
  const midday = moment(date).hours(12).minutes(0);
  const { sunrise, sunset} = getTimes(midday, location.latitude, location.longitude);

  return {
    sunrise,
    sunset
  };
}