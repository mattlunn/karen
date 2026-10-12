import dayjs from '../dayjs';
import type { Meal } from '../api/types';

const MEAL_TIMES: Record<Meal, string> = {
  BREAKFAST: '07:00',
  LUNCH: '12:00',
  DINNER: '17:00',
};

export function nextMealTime(meal: Meal, notBefore: Date): Date {
  const atDate = (date: string) => dayjs.tz(`${date} ${MEAL_TIMES[meal]}`, 'YYYY-MM-DD HH:mm', 'Europe/London');
  const today = atDate(dayjs(notBefore).format('YYYY-MM-DD'));

  return (today.isBefore(notBefore) ? atDate(dayjs(notBefore).add(1, 'day').format('YYYY-MM-DD')) : today).toDate();
}
