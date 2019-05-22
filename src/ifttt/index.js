import bus, { EVENT } from '../bus';
import config from '../config';
import * as handlers from './tt';
import { camelCase } from 'change-case';

bus.on(EVENT, async (event) => {
  for (const { ift, tt } of config.ifttt.events) {
    if (Object.keys(ift).every((t) => event[camelCase(t)] === ift[t])) {
      for (const { action, params } of tt) {
        await Promise.resolve(handlers[action](event, Object.keys(params).reduce((newObj, key) => {
          newObj[camelCase(key)] = params[key];

          return newObj;
        }, {})));
      }
    }
  }
});