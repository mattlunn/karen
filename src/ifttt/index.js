import bus, { EVENT } from '../bus';
import config from '../config';
import * as handlers from './tt';

bus.on(EVENT, async (event) => {
  for (const { ift, tt } of config.ifttt.events) {
    if (Object.keys(ift).every((t) => event[t] === ift[t])) {
      for (const { action, params } of tt) {
        await Promise.resolve(handlers[action](event, params));
      }
    }
  }
});