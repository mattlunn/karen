const mockEv = {
  getIsPrecooling: jest.fn(),
  setIsPreheating: jest.fn(),
  setIsPrecooling: jest.fn(),
};

const mockFindByCapability = jest.fn();
const mockNotify = jest.fn();

jest.mock('../../../config', () => ({}));
jest.mock('../../../logger', () => ({ error: jest.fn() }));
jest.mock('../index', () => ({ messages: new Map() }));
jest.mock('../../../models', () => ({
  Device: { findByCapability: (...args: unknown[]) => mockFindByCapability(...args) },
  Log: { notify: (...args: unknown[]) => mockNotify(...args) },
  Stay: jest.fn(),
}));

import { messages } from '../index';
import { intentHandlers } from './index';

describe('WhatsTheMessage', () => {
  const whatsTheMessage = (device: string) => intentHandlers.WhatsTheMessage({ name: 'WhatsTheMessage', slots: { device: { value: device } } });

  beforeEach(() => {
    messages.clear();
  });

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

describe('car climate intents', () => {
  const intent = (name: string) => ({ name, slots: {} });
  const car = { getElectricVehicleCapability: () => mockEv };

  beforeEach(() => {
    jest.resetAllMocks();
    mockFindByCapability.mockResolvedValue([car]);
    mockEv.setIsPreheating.mockResolvedValue(undefined);
    mockEv.setIsPrecooling.mockResolvedValue(undefined);
  });

  it('starts preheating', async () => {
    const response = await intentHandlers.PreheatCar(intent('PreheatCar'));

    expect(mockEv.setIsPreheating).toHaveBeenCalledWith(true);
    expect(response).toMatchObject({ outputSpeech: { text: 'Karen is warming up the car' }, shouldEndSession: true });
  });

  it('starts precooling', async () => {
    await intentHandlers.PrecoolCar(intent('PrecoolCar'));

    expect(mockEv.setIsPrecooling).toHaveBeenCalledWith(true);
  });

  it('stops precooling when the car is precooling', async () => {
    mockEv.getIsPrecooling.mockResolvedValue(true);

    await intentHandlers.StopCarClimate(intent('StopCarClimate'));
    await new Promise(setImmediate);

    expect(mockEv.setIsPrecooling).toHaveBeenCalledWith(false);
    expect(mockEv.setIsPreheating).not.toHaveBeenCalled();
  });

  it('stops preheating otherwise', async () => {
    mockEv.getIsPrecooling.mockResolvedValue(false);

    await intentHandlers.StopCarClimate(intent('StopCarClimate'));
    await new Promise(setImmediate);

    expect(mockEv.setIsPreheating).toHaveBeenCalledWith(false);
    expect(mockEv.setIsPrecooling).not.toHaveBeenCalled();
  });

  it('notifies when the car rejects the command', async () => {
    mockEv.setIsPreheating.mockRejectedValue(new Error('bridge down'));

    await intentHandlers.PreheatCar(intent('PreheatCar'));
    await new Promise(setImmediate);

    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Alexa couldn\'t start preheating the car' }));
  });
});
