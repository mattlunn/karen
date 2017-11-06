import request from 'request-promise-native';
import EventSource from 'eventsource';
import EventEmitter from 'events';
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

export function watchPresence() {
  const emitter = new EventEmitter();
  const instance = new EventSource(constructApiUrl(`structures/${config.nest.structure_id}/away`), {
    headers: {
      Authorization: `Bearer ${config.nest.auth_token}`
    }
  });

  instance.addEventListener('put', (e) => {
    // {
    //   type: 'put',
    //     data: '{"path":"/structures/j5mcj9nS3w-zcIvXteycHM4Pr-Sw-V5qW56p4lSuFqdFqjbzBCs0_Q/away","data":"home"}',
    //   lastEventId: '',
    //   origin: 'https://firebase-apiserver09-tah01-iad01.dapi.production.nest.com:9553' }

    if (e.type === 'put') {
      let data;

      try {
        data = JSON.parse(e.data);
      } catch (e) {
        return console.error(`Error whilst parsing EventSource data as JSON. data was '${e.data}`);
      }

      if (data.data === 'home') {
        emitter.emit('home');
      } else if (data.data === 'away') {
        emitter.emit('away');
      }
    }
  });

  instance.onerror = (e) => {
    throw new Error(`EventSource error (${e.message})`);
  };

  // TODO: Handle errors (reconnect?)
  // TODO: Disconnect when no listeners?

  return emitter;
}