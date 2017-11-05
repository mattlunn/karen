import request from 'request-promise-native';
import config from '../config';

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