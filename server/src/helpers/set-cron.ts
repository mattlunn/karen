import { Cron } from 'croner';
import logger from '../logger';

// Every job runs in the house's timezone, so patterns like `0 0 * * *` mean local
// midnight year round rather than drifting an hour with BST. `protect` skips a tick
// whose predecessor is still running, which croner can only honour because it awaits
// the callback - so async jobs never overlap themselves.
export default function setCron(func: () => unknown, cron: string): Cron {
  return new Cron(cron, {
    timezone: 'Europe/London',
    protect: (job) => logger.warn(`Cron: skipping ${job.getPattern()} tick, previous run started ${job.currentRun()?.toISOString()} is still going`),
  }, async () => {
    await func();
  });
}
