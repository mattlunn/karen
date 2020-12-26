import { Device } from '../../../models';
import { Op } from 'sequelize';
import { changeLightsToDesiredState } from '../helpers/lights';
import { pluralise, joinWithAnd } from '../../../helpers/array';

function getRoomNames(slotValue) {
  /*
    "slotValue": {
        "type": "List",
        "values": [
            {
                "type": "Simple",
                "value": "dining"
            },
            {
                "type": "Simple",
                "value": "kitchen"
            }
        ]
    }

    OR

    "slotValue": {
        "type": "Simple",
        "value": "dining room"
    }
  */

  if (slotValue.type === 'Simple') {
    return [slotValue.value];
  }

  return slotValue.values.map(x => x.value);
}

export default async function (intent) {
  const roomNames = getRoomNames(intent.slots.deviceName.slotValue);
  const desiredState = intent.slots.deviceState.resolutions.resolutionsPerAuthority[0].values[0].value === 'On';
  const devices = await Device.findAll({
    where: {
      name: {
        [Op.or]: roomNames.map(roomName => ({ [Op.like]: `${roomName}%` }))
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

    str += ` light${pluralise(successfulUpdates)} in the ${joinWithAnd(roomNames)} ${successfulUpdates.length === 1 ? 'has' : 'have'} been turned ${desiredState ? 'on': 'off'} `;
  }

  if (failedUpdates.length > 0) {
    if (successfulUpdates.length > 0) {
      str += `but `;
    }

    str += `Karen could not turn off the ${joinWithAnd(failedUpdates.map(x => x.name))} light${pluralise(successfulUpdates)}`;
  } else if (successfulUpdates.length === 0) {
    str += `Karen could not find any ${joinWithAnd(roomNames)} lights`;
  }

  return {
    outputSpeech: {
      type: 'PlainText',
      text: str
    }
  };
}