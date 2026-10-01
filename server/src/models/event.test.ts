import { Sequelize } from 'sequelize';
import eventFactory, { Event } from './event';

jest.mock('./device', () => ({ Device: class {} }));

describe('Event', () => {
  beforeAll(() => {
    eventFactory(new Sequelize('mysql://user:password@localhost/db', { logging: false }));
  });

  it('builds an open event with a null end', () => {
    const event = Event.build({
      deviceId: 1,
      start: new Date(),
      lastReported: new Date(),
      type: 'appliance_running',
      value: 1,
      instanceId: null
    });

    expect(event.end).toBeNull();
  });
});
