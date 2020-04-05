import { Device } from '../../../models';
import { Op } from 'sequelize';
import { joinWithAnd, pluralise } from '../helpers/speech';
import { changeLightsToDesiredState } from '../helpers/lights';

export default async function (intent) {
  const roomName = intent.slots.deviceName.value;
  const desiredState = intent.slots.deviceState.value === 'on';
  const devices = await Device.findAll({
    where: {
      name: {
        [Op.like]: `${roomName}%`
      },
      type: 'light'
    }
  });

  const {
    successfulUpdates,
    failedUpdates
  } = await changeLightsToDesiredState(devices, desiredState);

  let str = '';

  if (successfulUpdates.length > 0) {
    if (failedUpdates.length > 0) {
      str += `${successfulUpdates.length} of the `;
    } else {
      str += `The ${successfulUpdates.length === 1 ? '' : successfulUpdates.length} `;
    }

    str += `${roomName} light${pluralise(successfulUpdates)} ${successfulUpdates.length === 1 ? 'has' : 'have'} been turned ${desiredState ? 'on': 'off'} `;
  }

  if (failedUpdates.length > 0) {
    if (successfulUpdates.length > 0) {
      str += `but `;
    }

    str += `Karen could not turn off the ${joinWithAnd(failedUpdates)} light${pluralise(successfulUpdates)}`;
  } else if (successfulUpdates.length === 0) {
    str += `Karen could not find any ${roomName} lights`;
  }

  return {
    outputSpeech: {
      type: 'PlainText',
      text: str
    }
  };
};