import { nextMealTime } from './meals';

describe('nextMealTime', () => {
  it('returns later today when the meal is still to come', () => {
    expect(nextMealTime('DINNER', new Date('2026-10-12T09:00:00Z'))).toEqual(new Date('2026-10-12T16:00:00Z'));
  });

  it('returns tomorrow once the meal has passed', () => {
    expect(nextMealTime('BREAKFAST', new Date('2026-10-12T09:00:00Z'))).toEqual(new Date('2026-10-13T06:00:00Z'));
  });

  it('includes a meal exactly at the bound', () => {
    expect(nextMealTime('LUNCH', new Date('2026-10-12T11:00:00Z'))).toEqual(new Date('2026-10-12T11:00:00Z'));
  });

  it('uses UK local time across the clocks going back', () => {
    // BST ends at 02:00 local on 25 October 2026, so breakfast moves from 06:00Z to 07:00Z.
    expect(nextMealTime('BREAKFAST', new Date('2026-10-24T20:00:00Z'))).toEqual(new Date('2026-10-25T07:00:00Z'));
  });
});
