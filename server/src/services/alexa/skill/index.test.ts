jest.mock('../../../config', () => ({}));
jest.mock('../../../logger', () => ({ error: jest.fn() }));
jest.mock('../index', () => ({ messages: new Map() }));
jest.mock('../../../models', () => ({ Stay: jest.fn() }));

import { messages } from '../index';
import { intentHandlers } from './index';

const whatsTheMessage = (device: string) => intentHandlers.WhatsTheMessage({ name: 'WhatsTheMessage', slots: { device: { value: device } } });

beforeEach(() => {
  messages.clear();
});

describe('WhatsTheMessage', () => {
  it('reads the message queued for the named device, ignoring case', async () => {
    messages.set('Downstairs Alexa', { getMessageToSend: () => 'Welcome home' });

    const response = await whatsTheMessage('downstairs alexa');

    expect(response).toMatchObject({ outputSpeech: { ssml: '<speak>Welcome home</speak>' } });
    expect(messages.has('Downstairs Alexa')).toBe(false);
  });

  it('matches a device named at the end of a longer phrase', async () => {
    messages.set('Downstairs Alexa', { getMessageToSend: () => 'Welcome home' });

    const response = await whatsTheMessage('mesage for the downstairs Alexa');

    expect(response).toMatchObject({ outputSpeech: { ssml: '<speak>Welcome home</speak>' } });
  });

  it('ends the session silently when the device has no message', async () => {
    messages.set('Kitchen Alexa', { getMessageToSend: () => 'Welcome home' });

    expect(await whatsTheMessage('downstairs alexa')).toEqual({ shouldEndSession: true });
    expect(messages.has('Kitchen Alexa')).toBe(true);
  });
});
