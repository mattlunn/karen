import dayjs from '../../../dayjs';
import { parse, end } from 'iso8601-duration';
import logger from '../../../logger';
import { Device, Log, Stay } from '../../../models';
import { ElectricVehicleCapability } from '../../../models/capabilities';
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

// Car climate intents — preheat, precool, or stop the car's climate control

async function changeCarClimate(change: (ev: ElectricVehicleCapability) => Promise<void>, confirmation: string, failure: string) {
  const [device] = await Device.findByCapability('ELECTRIC_VEHICLE');

  if (!device) {
    throw new Error('No electric vehicle device found');
  }

  // Not awaited: the car takes ~35s to act, and Alexa gives up on a response after 8s.
  change(device.getElectricVehicleCapability()).catch((error) => {
    logger.error(error);

    return Log.notify({
      severity: 'warning',
      devices: [device],
      message: failure,
    });
  });

  return {
    outputSpeech: {
      type: 'PlainText',
      text: confirmation
    },
    shouldEndSession: true
  };
}

function PreheatCar() {
  return changeCarClimate((ev) => ev.setIsPreheating(true), 'Karen is warming up the car', 'Alexa couldn\'t start preheating the car');
}

function PrecoolCar() {
  return changeCarClimate((ev) => ev.setIsPrecooling(true), 'Karen is cooling down the car', 'Alexa couldn\'t start precooling the car');
}

function StopCarClimate() {
  return changeCarClimate(async (ev) => {
    if (await ev.getIsPrecooling()) {
      await ev.setIsPrecooling(false);
    } else {
      await ev.setIsPreheating(false);
    }
  }, 'Karen is turning off the car\'s climate control', 'Alexa couldn\'t stop the car\'s climate control');
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
  'AMAZON.FallbackIntent': Fallback,
  PreheatCar,
  PrecoolCar,
  StopCarClimate
};
