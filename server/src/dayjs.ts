import dayjsLib, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import duration from 'dayjs/plugin/duration';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjsLib.extend(utc);
dayjsLib.extend(timezone);
dayjsLib.extend(duration);
dayjsLib.extend(advancedFormat);
dayjsLib.extend(isSameOrBefore);
dayjsLib.extend(isSameOrAfter);
dayjsLib.extend(customParseFormat);
dayjsLib.extend(relativeTime);

// We _need_ this to happen before any other imports happen. Unfortunately, babel/ webpack re-arrange imports
// so that they are before any code; so even if we put the below before other imports in client.js, it gets
// compiled to be after, so Dates created in the "main thread" (e.g. at startup), get created in the users TZ
// rather than the default.
dayjsLib.tz.setDefault('Europe/London');

type DateInput = Parameters<typeof dayjsLib>[0];

/**
 * Creates a dayjs object in the Europe/London timezone.
 * Use this instead of importing dayjs from the npm package directly.
 */
function dayjs(): Dayjs;
function dayjs(input: DateInput): Dayjs;
function dayjs(input: DateInput, format: string): Dayjs;
function dayjs(input?: DateInput, format?: string): Dayjs {
  if (input === undefined) {
    return dayjsLib.tz();
  }
  if (format !== undefined) {
    return dayjsLib.tz(input, format);
  }
  return dayjsLib.tz(input);
}

// Attach static methods from dayjsLib to our dayjs function
dayjs.duration = dayjsLib.duration;
dayjs.tz = dayjsLib.tz;
dayjs.unix = dayjsLib.unix;

export default dayjs;
export { Dayjs };
