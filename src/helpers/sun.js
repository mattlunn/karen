import { getTimes } from 'suncalc';
import { location } from '../config';

export default function(date) {
  const { sunrise, sunset} = getTimes(date, location.latitude, location.longitude);

  return {
    sunrise,
    sunset
  };
}