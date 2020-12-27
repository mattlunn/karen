import { Device, Arming, Op } from '../../../models';
import { changeLightsToDesiredState } from '../helpers/lights';
import { pluralise, joinWithAnd } from '../../../helpers/array';

function getResolvedSlotValue(slot) {
  return slot.resolutions.resolutionsPerAuthority[0].values[0].value.name;
}

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

  if (!slotValue) {
    return null;
  }

  if (slotValue.type === 'Simple') {
    return [slotValue.value];
  }

  return slotValue.values.map(x => x.value);
}

function getDevicesForRoomNames(roomNames) {
  const conditions = {
    where: {
      type: 'light'
    }
  };

  if (roomNames) {
    conditions.where.name = {
      [Op.or]: roomNames.map(roomName => ({ [Op.like]: `${roomName}%` }))
    };
  }

  return Device.findAll(conditions);
}

async function handleLightControl(intent) {
  let str = '';

  const desiredState = getResolvedSlotValue(intent.slots.deviceState) === 'On';
  const roomNames = getRoomNames(intent.slots.deviceName.slotValue);
  const devices = await getDevicesForRoomNames(roomNames);

  const {
    successfulUpdates,
    failedUpdates
  } = await changeLightsToDesiredState(devices, desiredState);

  if (successfulUpdates.length > 0) {
    if (roomNames === null) {
      str += `All of the lights have been turned ${desiredState ? 'on': 'off'} `;
    } else {
      if (failedUpdates.length > 0) {
        str += `${successfulUpdates.length} of the `;
      } else {
        str += `The ${successfulUpdates.length === 1 ? '' : successfulUpdates.length} `;
      }

      str += ` light${pluralise(successfulUpdates)} in the ${joinWithAnd(roomNames)} ${successfulUpdates.length === 1 ? 'has' : 'have'} been turned ${desiredState ? 'on': 'off'} `;
    }
  }

  if (failedUpdates.length > 0) {
    if (successfulUpdates.length > 0) {
      str += `but `;
    }

    str += `Karen could not turn off the ${joinWithAnd(failedUpdates.map(x => x.name))} light${pluralise(successfulUpdates)}`;
  } else if (successfulUpdates.length === 0) {
    str += `Karen could not find any ${joinWithAnd(roomNames)} lights`;
  }

  return str;
}

async function handleAlarmControl(intent) {
  const desiredState = getResolvedSlotValue(intent.slots.deviceState) === 'On';
  const activeArming = await Arming.getActiveArming();

  if (desiredState === !!activeArming) {
    return `The alarm is already ${desiredState ? 'on' : 'off'}`;
  }

  if (desiredState === true) {
    await Arming.create({
      start: Date.now(),
      mode: Arming.MODE_NIGHT
    });

    return `The alarm is now on.`;
  } else /* desiredState === false */ {
    if (activeArming.mode === Arming.MODE_AWAY) {
      return `Karen can only turn the night time alarm off via Alexa. You need to turn this alarm off using the Karen website`;
    }

    // What happens if an activation is active?
    activeArming.end = Date.now();
    await activeArming.save();

    return `The alarm is now off.`;
  }
}

export default async function (intent) {
  const deviceType = getResolvedSlotValue(intent.slots.deviceType);
  let str = '';

  if (deviceType === 'light') {
    str = await handleLightControl(intent);
  } else if (deviceType === 'alarm') {
    str = await handleAlarmControl(intent);
  } else {
    str = `Karen does not know how to control a ${deviceType}`;
  }

  return {
    outputSpeech: {
      type: 'PlainText',
      text: str
    }
  };
}