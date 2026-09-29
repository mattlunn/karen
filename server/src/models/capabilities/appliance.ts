import { ApplianceBaseCapability } from './capabilities.gen';
import dayjs from '../../dayjs';

export class ApplianceCapability extends ApplianceBaseCapability {
  async getRunsPerWeek(now: Date = new Date()): Promise<number> {
    const windowStart = dayjs(now).subtract(28, 'day');
    const since = windowStart.isAfter(this.device.createdAt) ? windowStart : dayjs(this.device.createdAt);
    const days = dayjs(now).diff(since, 'day', true);

    if (days <= 0) {
      return 0;
    }

    const sinceDate = since.toDate();
    const runs = await this.getIsRunningHistory({ since: sinceDate, until: now });
    const runsStarted = runs.filter(run => run.start >= sinceDate);

    return runsStarted.length / days * 7;
  }

  async getTabletsRemaining(): Promise<number | null> {
    const lastCounted = await this.getTabletsLastCountedEvent();

    if (lastCounted === null) {
      return null;
    }

    const runsSinceCounted = await this.getIsRunningHistory({ since: lastCounted.start, until: new Date() });
    const runsAfterCounted = runsSinceCounted.filter(run => run.start > lastCounted.start);

    return Math.max(0, lastCounted.value - runsAfterCounted.length);
  }
}
