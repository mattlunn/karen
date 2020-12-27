import { Device } from '../../../models';
import { joinWithAnd, pluralise } from '../../../helpers/array';
import { changeLightsToDesiredState } from '../helpers/lights';

export default async function ({ slots: { roomName }}) {
  let devices = await Device.findAll({
    where: {
      type: 'light'
    }
  });

  if (roomName.value) {
    devices = devices.filter(x => !x.name.toLowerCase().includes(roomName.value.toLowerCase()));
  }

  const { failedUpdates } = await changeLightsToDesiredState(devices, false);
  let str = `Karen has turned off all the ${roomName.value ? 'other ' : ''}lights`;

  if (failedUpdates.length > 0) {
    str += `, except the ${joinWithAnd(failedUpdates.map(x => x.name))} light${pluralise(failedUpdates)}`;
  }

  return {
    outputSpeech: {
      type: 'PlainText',
      text: str
    }
  };
}