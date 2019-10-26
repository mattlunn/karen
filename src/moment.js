import moment from 'moment-timezone';

// We _need_ this to happen before any other imports happen. Unfortunately, babel/ webpack re-arrange imports
// so that they are before any code; so even if we put the below before other imports in client.js, it gets
// compiled to be after, so Dates created in the "main thread" (e.g. at startup), get created in the users TZ
// rather than the default.
moment.tz.setDefault('Europe/London');

export default moment;