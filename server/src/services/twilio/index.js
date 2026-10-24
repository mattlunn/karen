import TwilioClient from 'twilio';
import config from '../../config';
import logger from '../../logger';
import bus, { LOG_CREATED } from '../../bus';

const client = new TwilioClient(config.twilio.account_sid, config.twilio.auth_token);

function call(user, message) {
  return client.calls.create({
    twiml: message,
    to: user.mobileNumber,
    from: config.twilio.number
  });
}

function callWithKarenMessage(user, message) {
  return call(
    user,
    `<Response><Say voice="woman">Hi ${user.handle}. This is Karen. ${message}. I repeat. ${message}. Stay safe. Goodbye.</Say></Response>`
  );
}

bus.on(LOG_CREATED, async ({ log }) => {
  if (log.severity !== 'critical') {
    return;
  }

  try {
    const users = (await log.getAudienceUsers()).filter(user => user.mobileNumber);

    for (const user of users) {
      if (config.twilio.mode === 'readonly') {
        logger.info(`Twilio: [readonly] would call ${user.handle} with "${log.message}"`);
        continue;
      }

      callWithKarenMessage(user, log.message).catch(e => logger.error(e, `Failed to call ${user.handle}`));
    }
  } catch (e) {
    logger.error(e, `Failed to place calls for "${log.message}"`);
  }
});
