import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import duration from 'dayjs/plugin/duration';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(advancedFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);

// We _need_ this to happen before any other imports happen. Unfortunately, babel/ webpack re-arrange imports
// so that they are before any code; so even if we put the below before other imports in client.js, it gets
// compiled to be after, so Dates created in the "main thread" (e.g. at startup), get created in the users TZ
// rather than the default.
dayjs.tz.setDefault('Europe/London');

export default dayjs;
export { Dayjs };
