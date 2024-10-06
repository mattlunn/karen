import { messages } from '../index';
import logger from '../../../logger';

export default async function ({ slots: { device }}) {
  const deviceName = device.resolutions.resolutionsPerAuthority[0]?.values[0]?.value.name;
  const message = messages.get(deviceName)?.getMessageToSend();

  if (!message) {
    logger.error(`"${deviceName}" asked for messages, but there was none.`);
    return;
  }

  messages.delete(deviceName);

  return {
    outputSpeech: {
      type: 'SSML',
      ssml: `<speak>${message}</speak>`
    }
  };
}