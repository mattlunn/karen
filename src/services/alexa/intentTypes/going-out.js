import moment from 'moment-timezone';
import config from '../../../config.json';
import { parse, end } from 'iso8601-duration';
import { Stay } from '../../../models';

function figureOutEta(slots) {
  if (slots.duration.value) {
    return end(parse(slots.duration.value));
  } else if (slots.dateBack.value) {
    const date = moment.tz(`${slots.dateBack.value} ${slots.timeBack.value}`, 'YYYY-MM-DD HH:mm', config.timezone);

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

    while (date.isBefore(now)) {
      date.add(12, 'hours');
    }

    return date.toDate();
  }

  return null;
}

export default async function (intent) {
  const eta = figureOutEta(intent.slots);
  const stay = new Stay();

  stay.eta = eta;

  await stay.save();

  return {
    outputSpeech: {
      type: 'PlainText',
      text: `Karen said she's missing you already`
    }
  };
}