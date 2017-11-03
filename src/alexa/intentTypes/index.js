import moment from 'moment';
import { parse, end } from 'iso8601-duration';

function figureOutEta(slots) {
  if (slots.duration.value) {
    return end(parse(slots.duration.value));
  } else if (slots.dateBack.value) {
    const date = moment(`${slots.dateBack.value} ${slots.timeBack.value}`, 'YYYY-MM-DD HH:mm');

    if (date.isValid()) {
      return date.toDate();
    } else {
      throw new Error('Date input not valid');
    }
  } else if (slots.timeBack.value) {
    const date = moment(slots.timeBack.value, 'HH:mm');
    const now = moment();

    if (!date.isValid()) {
      throw new Error('Time input not valid');
    }

    if (date.isBefore(now)) {
      date.add(1, 'day');
    }

    return date.toDate();
  }

  return null;
}

export const GoingOut = async (intent) => {
  const eta = figureOutEta(intent.slots);

  console.dir(intent.slots);
  console.dir(eta);

  return {
    outputSpeech: {
      type: 'PlainText',
      text: `Karen said she's missing you already`
    }
  };
};