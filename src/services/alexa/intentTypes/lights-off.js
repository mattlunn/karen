import { Device } from '../../../models';
import { joinWithAnd, pluralise } from '../../../helpers/array';
import { changeLightsToDesiredState } from '../helpers/lights';

export default async function () {
  const devices = await Device.findAll({
    where: {
      type: 'light'
    }
  });

  const { failedUpdates } = await changeLightsToDesiredState(devices, false);
  let str = `Karen has turned off all the lights`;

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