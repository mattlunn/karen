import TwilioClient from 'twilio';
import config from '../../config/app';

const client = new TwilioClient(config.twilio.account_sid, config.twilio.auth_token);

export function call(user, message) {
  return client.calls.create({
    twiml: message,
    to: user.mobileNumber,
    from: config.twilio.number
  });
}

export function callWithKarenMessage(user, message) {
  return call(
    user,
    `<Response><Say voice="woman">Hi ${user.handle}. This is Karen. ${message}. I repeat. ${message}. Stay safe. Goodbye.</Say></Response>`
  );
}