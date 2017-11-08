import moment from 'moment';
import { parse, end } from 'iso8601-duration';
import { Stay } from '../../models';
import { setAway } from '../../nest';

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

    while (date.isBefore(now)) {
      date.add(12, 'hours');
    }

    return date.toDate();
  }

  return null;
}

export const GoingOut = async (intent) => {
  const eta = figureOutEta(intent.slots);
  let stay = await Stay.findUpcomingStay();

  if (stay === null) {
    stay = new Stay();
  }

  stay.eta = eta;
  stay.etaSentToNestAt = null;

  await stay.save();
  await setAway(true);

  return {
    outputSpeech: {
      type: 'PlainText',
      text: `Karen said she's missing you already`
    }
  };
};