import { getTimes } from 'suncalc';
import { location } from '../config';
import { dayjs } from '../dayjs';

export default function(date) {
  // Due to https://github.com/mourner/suncalc/issues/107
  const midday = dayjs(date).hour(12).minute(0);
  const { sunrise, sunset} = getTimes(midday, location.latitude, location.longitude);

  return {
    sunrise,
    sunset
  };
}