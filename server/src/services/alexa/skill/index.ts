import dayjs from '../../../dayjs';
import { parse, end } from 'iso8601-duration';
import logger from '../../../logger';
import { Stay } from '../../../models';
import { messages } from '../index';
import { AlexaIntent } from './types';

// GoingOut intent — records an outgoing stay with an ETA

interface GoingOutSlots {
  duration: { value: string | null };
  dateBack: { value: string | null };
  timeBack: { value: string | null };
}

function figureOutEta(slots: GoingOutSlots): Date | null {
  if (slots.duration.value) {
    return end(parse(slots.duration.value));
  } else if (slots.dateBack.value) {
    const date = dayjs.tz(`${slots.dateBack.value} ${slots.timeBack.value}`, 'YYYY-MM-DD HH:mm', 'Europe/London');

    if (date.isValid()) {
      return date.toDate();
    } else {
      throw new Error('Date input not valid');
    }
  } else if (slots.timeBack.value) {
    let date = dayjs(slots.timeBack.value, 'HH:mm');
    const now = dayjs();

    if (!date.isValid()) {
      throw new Error('Time input not valid');
    }

    while (date.isBefore(now)) {
      date = date.add(12, 'hours');
    }

    return date.toDate();
  }

  return null;
}

interface GoingOutIntent {
  slots: GoingOutSlots;
}

async function GoingOut(intent: GoingOutIntent) {
  const eta = figureOutEta(intent.slots);
  const stay = new Stay();

  stay.eta = eta;

  await stay.save();

  return {
    outputSpeech: {
      type: 'PlainText',
      text: `Karen said she's missing you already`
    },
    shouldEndSession: true
  };
}

// WhatsTheMessage intent — retrieves and returns the queued TTS message

interface WhatsTheMessageIntent {
  slots: { device: { value?: string } };
}

async function WhatsTheMessage({ slots: { device } }: WhatsTheMessageIntent) {
  // The routines' text is "whats the mesage for the <device>", which Alexa only matches as "whats the {device}".
  const deviceName = [...messages.keys()].find((name) => device.value?.toLowerCase().endsWith(name.toLowerCase()));
  const message = messages.get(deviceName)?.getMessageToSend();

  if (!message) {
    logger.error(`"${device.value}" asked for messages, but there was none.`);

    // Alexa rejects a response with no `response` key as malformed, so end the session silently
    // rather than returning nothing.
    return { shouldEndSession: true };
  }

  messages.delete(deviceName);

  return {
    outputSpeech: {
      type: 'SSML',
      ssml: `<speak>${message}</speak>`
    },
    shouldEndSession: true
  };
}

async function endSession() {
  return { shouldEndSession: true };
}

async function Fallback() {
  return {
    outputSpeech: {
      type: 'PlainText',
      text: 'Karen didn\'t understand that'
    },
    shouldEndSession: true
  };
}

// Dispatch

export const intentHandlers: Record<string, (intent: AlexaIntent) => Promise<unknown>> = {
  GoingOut: GoingOut as unknown as (intent: AlexaIntent) => Promise<unknown>,
  WhatsTheMessage: WhatsTheMessage as unknown as (intent: AlexaIntent) => Promise<unknown>,
  'AMAZON.CancelIntent': endSession,
  'AMAZON.StopIntent': endSession,
  'AMAZON.NavigateHomeIntent': endSession,
  'AMAZON.HelpIntent': endSession,
  'AMAZON.FallbackIntent': Fallback
};
