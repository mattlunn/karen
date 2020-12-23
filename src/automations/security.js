import bus, { EVENT_START } from '../bus';
import { Device, Arming, Stay, User, Event } from '../models';
import { call } from '../services/twilio';
import moment from 'moment';

async function turnOnAllTheLights() {
  const lights = await Device.findByType('light');

  for (const light of lights) {
    light.setProperty('on', true);
  }
}

async function getAbsentUsersWithMobileNumbers() {
  const [
    currentStays,
    allUsers
  ] = await Promise.all([
    Stay.findCurrentStays(),
    User.findAll()
  ]);

  return allUsers.filter(user => !!user.mobileNumber && !currentStays.some(stay => stay.userId === user.id));
}

async function notifyAbsentUsersOfEvent(event) {
  const usersWithNumber = await getAbsentUsersWithMobileNumbers();
  const device = await event.getDevice();
  const message = `Motion was detected by the ${device.name} at ${moment(event.start).format('HH:mm:ss')}`;

  for (const user of usersWithNumber) {
    call(user, `<Response><Say voice="woman">Hi ${user.handle}. This is Karen. ${message}. I repeat ${message}. Stay safe. Goodbye.</Say></Response>`);
  }
}

/*
  const event = await Event.findOne({
    where: {
      id: 468157
    }
  });


  return;
*/

export default async function (opts) {
  bus.on(EVENT_START, async (event) => {
    if (event.type === 'motion') {
      const arming = await Arming.getActiveArming(event.start);

      if (arming) {
        notifyAbsentUsersOfEvent(event);
        turnOnAllTheLights();

        if (arming.mode === Arming.MODE_NIGHT) {

        }
      }
    }
  });
}