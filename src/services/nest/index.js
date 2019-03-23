import request from 'request-promise-native';
import config from '../../config';
import EventSource from 'eventsource';

import bus, {
  LAST_USER_LEAVES,
  NEST_HEATING_STATUS_CHANGE,
  NEST_OCCUPANCY_STATUS_CHANGE
} from '../../bus';

let last = null;
let current = null;

const source = new EventSource('https://developer-api.nest.com', {
  headers: {
    Authorization: `Bearer ${config.nest.auth_token}`
  }
});

function _getHeatingStatus(data) {
  return data.structures[config.nest.structure_id].thermostats.map((id) => {
    const thermostat = data.devices.thermostats[id];
    let target;

    switch (thermostat.hvac_mode) {
      case 'heat':
        target = thermostat.target_temperature_c;
        break;
      case 'eco':
        target = thermostat.eco_temperature_low_c;
        break;
      case 'off':
        target = null;
        break;
      default:
        throw new Error(`"${thermostat.hvac_mode}" is not a recognised thermostat mode`);
    }

    return {
      humidity: thermostat.humidity,
      id: thermostat.device_id,
      name: thermostat.name,
      target: target,
      current: thermostat.ambient_temperature_c,
      heating: thermostat.hvac_state === 'heating'
    };
  });
}

function _getOccupancyStatus(data) {
  const structure = data.structures[config.nest.structure_id];

  return {
    home: structure.away === 'home',
    eta: new Date(structure.eta_begin)
  };
}

function emitIfAnyChanged(factory, event, last, current, matcher) {
  const lastState = last ? factory(last) : [];
  const currentState = factory(current);

  for (const item of currentState) {
    emitIfChanged(event, lastState.find(matcher), item);
  }
}

function emitIfChanged(event, last, current) {
  const keys = Object.keys(current);
  const getRawValue = (value) => value === null || value === undefined
    ? value
    : value.valueOf();

  for (const key of keys) {
    const currentStateValue = getRawValue(current[key]);
    const lastStateValue = getRawValue(last
      ? last[key]
      : null);

    if (currentStateValue !== lastStateValue) {
      console.log(`Nest - ${key} has changed from ${lastStateValue} to ${currentStateValue}`);

      bus.emit(event, current);
      break;
    }
  }
}

function constructApiUrl(endpoint) {
  return `https://developer-api.nest.com/${endpoint}`;
}

function addCommonRequestParameters(obj) {
  return {
    ...obj,
    auth: {
      bearer: config.nest.auth_token
    },
    followAllRedirects: true,
    followOriginalHttpMethod: true,
    strictSSL: false
  };
}

export async function setAway(away) {
  await request.put(constructApiUrl(`structures/${config.nest.structure_id}`), addCommonRequestParameters({
    body: {
      away: away ? 'away' : 'home'
    },
    json: true
  }));

  return true;
}

export async function setTargetTemperature(thermostat, temperature) {
  await request.put(
    constructApiUrl(`devices/thermostats/${thermostat}`),
    addCommonRequestParameters({
      body: {
        hvac_mode: temperature === null ? 'off' : 'heat'
      },
      json: true
    })
  );

  if (temperature !== null) {
    await request.put(
      constructApiUrl(`devices/thermostats/${thermostat}`),
      addCommonRequestParameters({
        body: {
          target_temperature_c: temperature
        },
        json: true
      })
    );
  }
}

export async function setEta(id, etaStart, etaEnd) {
  await request.put(constructApiUrl(`structures/${config.nest.structure_id}/eta.json`), addCommonRequestParameters({
    body: {
      trip_id: id.toString(),
      estimated_arrival_window_begin: etaStart,
      estimated_arrival_window_end: etaEnd || etaStart
    },
    json: true
  }));

  return true;
}

export const getHeatingStatus = () => _getHeatingStatus(current);
export const getOccupancyStatus = () => _getOccupancyStatus(current);

bus.on(LAST_USER_LEAVES, () => {
  setAway(true).catch((error) => {
    console.log('An error occurred whilst setting Nest to away');
    console.dir(error);
  });
});

source.addEventListener('error', (event) => {
  console.error('Nest connection closed', event);
});

source.addEventListener('open', () => {
  console.log('Nest connection opened...');
});

source.addEventListener('put', (data) => {
  last = current;
  current = JSON.parse(data.data).data;

  console.log('Received update fom Nest');

  emitIfAnyChanged(_getHeatingStatus, NEST_HEATING_STATUS_CHANGE, last, current, x => x.id);
  emitIfChanged(NEST_OCCUPANCY_STATUS_CHANGE, last && _getOccupancyStatus(last), _getOccupancyStatus(current));
});
