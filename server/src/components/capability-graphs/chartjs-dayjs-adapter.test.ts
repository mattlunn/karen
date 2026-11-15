import { _adapters } from 'chart.js';
import './chartjs-dayjs-adapter';

const adapter = new _adapters._date();
const at = (iso: string) => Date.parse(iso);
const iso = (time: number) => new Date(time).toISOString();

describe('format', () => {
  it('labels ticks in London time', () => {
    expect(adapter.format(at('2026-07-15T12:00:00Z'), 'hA')).toBe('1PM');
    expect(adapter.format(at('2026-11-15T12:00:00Z'), 'hA')).toBe('12PM');
  });

  it('puts the first hour after London midnight on the London date', () => {
    expect(adapter.format(at('2026-10-23T23:30:00Z'), 'MMM D')).toBe('Oct 24');
  });
});

describe('startOf', () => {
  it('starts a BST day at London midnight', () => {
    expect(iso(adapter.startOf(at('2026-07-15T11:00:00Z'), 'day'))).toBe('2026-07-14T23:00:00.000Z');
  });

  it('keeps 00:00-01:00 BST on the London day, not the previous UTC one', () => {
    expect(iso(adapter.startOf(at('2026-10-23T23:30:00Z'), 'day'))).toBe('2026-10-23T23:00:00.000Z');
  });

  it('starts each clock-change day at London midnight', () => {
    expect(iso(adapter.startOf(at('2026-10-25T12:00:00Z'), 'day'))).toBe('2026-10-24T23:00:00.000Z');
    expect(iso(adapter.startOf(at('2026-03-29T12:00:00Z'), 'day'))).toBe('2026-03-29T00:00:00.000Z');
  });

  it('starts months at London midnight', () => {
    expect(iso(adapter.startOf(at('2026-10-15T12:00:00Z'), 'month'))).toBe('2026-09-30T23:00:00.000Z');
    expect(iso(adapter.startOf(at('2026-11-15T12:00:00Z'), 'month'))).toBe('2026-11-01T00:00:00.000Z');
  });

  it('starts the repeated 01:00 hour on its own occurrence', () => {
    expect(iso(adapter.startOf(at('2026-10-25T00:30:00Z'), 'hour'))).toBe('2026-10-25T00:00:00.000Z');
    expect(iso(adapter.startOf(at('2026-10-25T01:30:00Z'), 'hour'))).toBe('2026-10-25T01:00:00.000Z');
  });
});

describe('endOf', () => {
  it('ends a day just before the next London midnight', () => {
    expect(iso(adapter.endOf(at('2026-10-24T12:00:00Z'), 'day'))).toBe('2026-10-24T22:59:59.999Z');
    expect(iso(adapter.endOf(at('2026-10-25T12:00:00Z'), 'day'))).toBe('2026-10-25T23:59:59.999Z');
  });
});

describe('add', () => {
  it('steps days from London midnight to London midnight across both clock changes', () => {
    expect(iso(adapter.add(at('2026-10-24T23:00:00Z'), 1, 'day'))).toBe('2026-10-26T00:00:00.000Z');
    expect(iso(adapter.add(at('2026-03-29T00:00:00Z'), 1, 'day'))).toBe('2026-03-29T23:00:00.000Z');
  });

  it('steps months from London midnight to London midnight across a clock change', () => {
    expect(iso(adapter.add(at('2026-09-30T23:00:00Z'), 1, 'month'))).toBe('2026-11-01T00:00:00.000Z');
  });

  it('steps hours through the repeated 01:00 hour one real hour at a time', () => {
    expect(iso(adapter.add(at('2026-10-25T00:00:00Z'), 1, 'hour'))).toBe('2026-10-25T01:00:00.000Z');
    expect(iso(adapter.add(at('2026-10-24T23:00:00Z'), 2, 'hour'))).toBe('2026-10-25T01:00:00.000Z');
  });
});
