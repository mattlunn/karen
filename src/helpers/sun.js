import { getTimes } from 'suncalc';
import { location } from '../config';

export default function() {
  const { sunrise, sunset} = getTimes(new Date(), location.latitude, location.longitude);

  return {
    sunrise,
    sunset
  };
}