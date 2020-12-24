import { messages } from '../index';

export default async function ({ slots: { device }}) {
  const deviceName = device.resolutions.resolutionsPerAuthority[0]?.values[0]?.value.name;
  const messageQueue = messages.get(deviceName) || [];

  if (!messageQueue.length) {
    console.log(`"${deviceName}" asked for messages, but there were none in the queue.`);
    return;
  }

  return {
    outputSpeech: {
      type: 'SSML',
      ssml: `<speak>${messageQueue.splice(0).join('')}</speak>`
    }
  };
}