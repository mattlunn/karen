import TwilioClient from 'twilio';
import config from '../../config';

const client = new TwilioClient(config.twilio.account_sid, config.twilio.auth_token);

export function call(user, message) {
  return client.calls.create({
    twiml: message,
    to: user.mobileNumber,
    from: config.twilio.number
  });
}