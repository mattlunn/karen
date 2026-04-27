import * as intentTypes from '../intentTypes/index';

interface AlexaIntent {
  name: string;
  slots: Record<string, unknown>;
}

interface AlexaSkillRequest {
  type: string;
  intent: AlexaIntent;
}

export const IntentRequest = async (request: AlexaSkillRequest): Promise<unknown> => {
  if (Object.prototype.hasOwnProperty.call(intentTypes, request.intent.name)) {
    return await (intentTypes as unknown as Record<string, (intent: AlexaIntent) => Promise<unknown>>)[request.intent.name](request.intent);
  } else {
    throw new Error('Unable to handle intent ' + request.intent.name);
  }
};
