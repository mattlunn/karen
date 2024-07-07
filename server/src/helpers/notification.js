import { sendPushNotification } from '../services/pushover';

export function sendNotification(message) {
  console.log(`Sending notification "${message}"`);

  sendPushNotification(message);
}

/*

- Add a pushover_token to each user
- Need to map types of message to priority/ sound
  * E.g. 
      * alarm activation will have high priority (possible sound)
      * doorbell ring will have different sound
- Some events that trigger notifications will also have other events; e.g. lights on for alarm going off.
- Sooooo can either add new events to bus;
  * bus.emit('DOORBELL_RING', event)
  * ORRR can just depend on existing event.type
  * event.type === 'doorbell_ring'
  
  ... then have an automation/____.ts which listens for the above, then can get all users with a pushover_token, and then
  do the needful to get the data.

- BUT HOW DO YOU ABSTRACT THE PUSHOVER API FROM THE AUTOMATION?

*/