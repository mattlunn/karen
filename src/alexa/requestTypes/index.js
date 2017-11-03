import * as intentTypes from '../intentTypes';

export const IntentRequest = async (request) => {
  if (intentTypes.hasOwnProperty(request.intent.name)) {
    return await intentTypes[request.intent.name](request.intent);
  } else {
    throw new Error('Unable to handle intent ' + request.intent.name);
  }
};