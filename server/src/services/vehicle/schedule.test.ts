import dayjs from '../../dayjs';
import { buildChargingFailureNotification } from './schedule';

describe('buildChargingFailureNotification', () => {
  it('mentions the target percentage and time', () => {
    const targetTime = dayjs().hour(8).minute(30).second(0).millisecond(0);
    const message = buildChargingFailureNotification(80, targetTime, true);

    expect(message).toContain('80%');
    expect(message).toContain('08:30');
    expect(message).toContain('not charging');
  });

  it('uses "today" for a target time later the same day', () => {
    const targetTime = dayjs().hour(23).minute(0).second(0).millisecond(0);
    const message = buildChargingFailureNotification(90, targetTime, true);

    expect(message).toContain('today');
  });

  it('blames the bridge rather than the cable when the car is unreachable', () => {
    const targetTime = dayjs().hour(8).minute(30).second(0).millisecond(0);
    const message = buildChargingFailureNotification(80, targetTime, false);

    expect(message).toContain('80%');
    expect(message).toContain('kia-connect-bridge');
    expect(message).not.toContain('cable');
  });
});
