import { getLightsAndStatus as getLightsAndStatusFromLightwave, setLightFeatureValue as setLightwaveLightFeatureValue } from '../../services/lightwaverf';
import { getLightsAndStatus as getLightsAndStatusFromTpLink, turnLightOnOrOff as turnTpLinkLightOnOrOff } from '../../services/tplink';
import getSunriseAndSunset from '../../helpers/sun';
import moment from 'moment';

// "from" or "to" can be;
// - "sunrise", "sunset"
// - "sunrise + 1h30m 27s"
// - "00:00"

const turnOffs = new Map();

function normalizeDuration(offset) {
  const duration = moment.duration();

  // period === ["1h", "30m"]
  for (const period of offset.match(/\d+ *[a-zA-Z]/g)) {
    // [num, amount] === ["1", "h"]
    const [, num, amount] = period.match(/(\d+)(\w+)/);

    duration.add(+num, amount);
  }

  return duration;
}

function normalizeTime(time) {
  if (time.includes('sunrise') || time.includes('sunset')) {
    const sunEvents = getSunriseAndSunset();
    const [sunEvent, direction, offset] = time.split(/ *([+-]) */);
    const timeOfSunEvent = moment(sunEvents[sunEvent]);

    // offset === "1h30m"
    if (offset) {
      timeOfSunEvent[direction === '+' ? 'add' : 'subtract'](normalizeDuration(offset));
    }

    return timeOfSunEvent;
  } else {
    return moment(time, 'HH:mm');
  }
}

async function switchLight(light, value) {
  switch (light.provider) {
    case 'lightwaverf':
      await setLightwaveLightFeatureValue(light.switchFeatureId, value);
      break;
    case 'tplink':
      await turnTpLinkLightOnOrOff(lightId, value);
      break;
    default:
      throw new Error(`${light.provider} is not a recognised provider`);
  }
}

export default async function (event, { from, to, duration, lightId }) {
  // Motion has subsided. We only process turning on lights when motion starts.
  if (event.end) {
    return;
  }

  const lights = await Promise.all([
    getLightsAndStatusFromLightwave(),
    getLightsAndStatusFromTpLink()
  ]);

  console.dir(lights, { depth: null });

  const light = lights.flat().find(x => x.id === lightId);

  if ((!from || normalizeTime(from).isBefore(Date.now())) && (!to || normalizeTime(to).isAfter(Date.now()))) {
    if (!light.isOn && !light.switchIsOn) {
      console.log(`Switching light on, as it isn't currently on`);
      await switchLight(light, 1);
    } else {
      console.log(`Not switching light on, as it is currently on`);
    }

    if (duration) {
      const existingTimeout = turnOffs.get(lightId);

      if (existingTimeout) {
        console.log(`Clearing existing timeout to switch the light off`);
        clearTimeout(existingTimeout);
      }

      console.log(`Setting a timeout to switch the light off`);

      turnOffs.set(lightId, setTimeout(async () => {
        console.log(`Switching the light off`);
        await switchLight(light, 0);
      }, normalizeDuration(duration).asMilliseconds()));
    }
  } else {
    console.log(`Not executing IFTTT event, as we're outside the window`);
  }
}