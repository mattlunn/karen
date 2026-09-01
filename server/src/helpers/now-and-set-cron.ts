import { Cron } from 'croner';
import setCron from './set-cron';

// The immediate run goes through `trigger` rather than calling `func` directly so it
// counts as a run of the job, and `protect` can hold the first scheduled tick back
// until it finishes.
export default function nowAndSetCron(func: () => unknown, cron: string): Cron {
  const job = setCron(func, cron);

  job.trigger();

  return job;
}
