jest.mock('../../../config', () => ({}), { virtual: true });

import { setBooleanProperty, setNumericProperty } from './index';
import { Device, Event } from '../..';

// Mock the models
jest.mock('../..', () => ({
  Device: {},
  Event: {
    create: jest.fn(),
  },
  BooleanEvent: jest.fn(),
  NumericEvent: jest.fn(),
  Op: {},
}));

describe('setNumericProperty', () => {
  let mockDevice: { id: number; getLatestEvent: jest.Mock };
  let mockEvent: { start: Date; value: number; end: Date | null; lastReported: Date; save: jest.Mock; destroy: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDevice = {
      id: 1,
      getLatestEvent: jest.fn(),
    };
    mockEvent = {
      start: new Date('2024-01-15T00:00:00Z'),
      value: 100,
      end: null,
      lastReported: new Date('2024-01-15T00:00:00Z'),
      save: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('historic insert rejection', () => {
    it('throws error when timestamp is before latest event start', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEvent);
      const historicTimestamp = new Date('2024-01-14T00:00:00Z');

      await expect(
        setNumericProperty(mockDevice as unknown as Device, 'temperature', 50, historicTimestamp)
      ).rejects.toThrow('Cannot insert historic event');
    });
  });

  describe('fresh inserts', () => {
    it('creates new event when no existing event', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(null);
      const newEvent = { id: 1 };
      (Event.create as jest.Mock).mockResolvedValue(newEvent);

      const result = await setNumericProperty(
        mockDevice as unknown as Device,
        'temperature',
        50,
        new Date('2024-01-15T00:00:00Z')
      );

      expect(Event.create).toHaveBeenCalledWith(expect.objectContaining({
        deviceId: 1,
        type: 'temperature',
        value: 50,
      }));
      expect(result).toBe(newEvent);
    });

    it('creates new event when value changes', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEvent);
      const newTimestamp = new Date('2024-01-16T00:00:00Z');
      const newEvent = { id: 2 };
      (Event.create as jest.Mock).mockResolvedValue(newEvent);

      const result = await setNumericProperty(
        mockDevice as unknown as Device,
        'temperature',
        200,
        newTimestamp
      );

      expect(mockEvent.save).toHaveBeenCalled();
      expect(mockEvent.end).toEqual(newTimestamp);
      expect(Event.create).toHaveBeenCalled();
      expect(result).toBe(newEvent);
    });

    it('updates lastReported when value unchanged', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEvent);
      const newTimestamp = new Date('2024-01-16T00:00:00Z');

      const result = await setNumericProperty(
        mockDevice as unknown as Device,
        'temperature',
        100, // Same value
        newTimestamp
      );

      expect(mockEvent.save).toHaveBeenCalled();
      expect(mockEvent.lastReported).toEqual(newTimestamp);
      expect(Event.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('same timestamp updates', () => {
    it('updates value in place when timestamp matches latest event', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEvent);
      const sameTimestamp = new Date('2024-01-15T00:00:00Z');

      await setNumericProperty(
        mockDevice as unknown as Device,
        'temperature',
        200, // Different value
        sameTimestamp
      );

      expect(mockEvent.value).toBe(200);
      expect(mockEvent.lastReported).toEqual(sameTimestamp);
      expect(mockEvent.save).toHaveBeenCalled();
      expect(Event.create).not.toHaveBeenCalled();
    });

    it('returns null when value unchanged at same timestamp', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEvent);
      const sameTimestamp = new Date('2024-01-15T00:00:00Z');

      const result = await setNumericProperty(
        mockDevice as unknown as Device,
        'temperature',
        100, // Same value
        sameTimestamp
      );

      expect(mockEvent.save).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});

describe('setBooleanProperty', () => {
  let mockDevice: { id: number; getLatestEvent: jest.Mock };
  let mockEventOn: { start: Date; value: number; end: Date | null; lastReported: Date; save: jest.Mock; destroy: jest.Mock };
  let mockEventOff: { start: Date; value: number; end: Date; lastReported: Date; save: jest.Mock; destroy: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDevice = {
      id: 1,
      getLatestEvent: jest.fn(),
    };
    mockEventOn = {
      start: new Date('2024-01-15T00:00:00Z'),
      value: 1,
      end: null, // On = no end
      lastReported: new Date('2024-01-15T00:00:00Z'),
      save: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    mockEventOff = {
      start: new Date('2024-01-15T00:00:00Z'),
      value: 1,
      end: new Date('2024-01-15T01:00:00Z'), // Off = has end
      lastReported: new Date('2024-01-15T01:00:00Z'),
      save: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('historic insert rejection', () => {
    it('throws error when timestamp is before latest event start', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEventOn);
      const historicTimestamp = new Date('2024-01-14T00:00:00Z');

      await expect(
        setBooleanProperty(mockDevice as unknown as Device, 'isOn', true, historicTimestamp)
      ).rejects.toThrow('Cannot insert historic event');
    });
  });

  describe('fresh inserts', () => {
    it('creates new event when turning on (no prior event)', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(null);
      const newEvent = { id: 1 };
      (Event.create as jest.Mock).mockResolvedValue(newEvent);

      const result = await setBooleanProperty(
        mockDevice as unknown as Device,
        'isOn',
        true,
        new Date('2024-01-15T00:00:00Z')
      );

      expect(Event.create).toHaveBeenCalledWith(expect.objectContaining({
        deviceId: 1,
        type: 'isOn',
        value: 1,
      }));
      expect(result).toBe(newEvent);
    });

    it('creates new event when turning on (prior event was off)', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEventOff);
      const newTimestamp = new Date('2024-01-16T00:00:00Z');
      const newEvent = { id: 2 };
      (Event.create as jest.Mock).mockResolvedValue(newEvent);

      const result = await setBooleanProperty(
        mockDevice as unknown as Device,
        'isOn',
        true,
        newTimestamp
      );

      expect(Event.create).toHaveBeenCalled();
      expect(result).toBe(newEvent);
    });

    it('closes existing event when turning off', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEventOn);
      const newTimestamp = new Date('2024-01-16T00:00:00Z');

      await setBooleanProperty(
        mockDevice as unknown as Device,
        'isOn',
        false,
        newTimestamp
      );

      expect(mockEventOn.end).toEqual(newTimestamp);
      expect(mockEventOn.save).toHaveBeenCalled();
      expect(Event.create).not.toHaveBeenCalled();
    });

    it('updates lastReported when already on (true -> true)', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEventOn);
      const newTimestamp = new Date('2024-01-16T00:00:00Z');

      const result = await setBooleanProperty(
        mockDevice as unknown as Device,
        'isOn',
        true,
        newTimestamp
      );

      expect(mockEventOn.lastReported).toEqual(newTimestamp);
      expect(mockEventOn.save).toHaveBeenCalled();
      expect(Event.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('does nothing when already off (false -> false)', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEventOff);
      const newTimestamp = new Date('2024-01-16T00:00:00Z');

      const result = await setBooleanProperty(
        mockDevice as unknown as Device,
        'isOn',
        false,
        newTimestamp
      );

      expect(mockEventOff.lastReported).toEqual(newTimestamp);
      expect(mockEventOff.save).toHaveBeenCalled();
      expect(Event.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('same timestamp updates', () => {
    it('updates lastReported when on -> on at same timestamp', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEventOn);
      const sameTimestamp = new Date('2024-01-15T00:00:00Z');

      const result = await setBooleanProperty(
        mockDevice as unknown as Device,
        'isOn',
        true,
        sameTimestamp
      );

      expect(mockEventOn.save).toHaveBeenCalled();
      expect(mockEventOn.destroy).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('deletes event when on -> off at same timestamp', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEventOn);
      const sameTimestamp = new Date('2024-01-15T00:00:00Z');

      const result = await setBooleanProperty(
        mockDevice as unknown as Device,
        'isOn',
        false,
        sameTimestamp
      );

      expect(mockEventOn.destroy).toHaveBeenCalled();
      expect(mockEventOn.save).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('throws error when off -> on at same timestamp', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEventOff);
      const sameTimestamp = new Date('2024-01-15T00:00:00Z');

      await expect(
        setBooleanProperty(mockDevice as unknown as Device, 'isOn', true, sameTimestamp)
      ).rejects.toThrow('Cannot turn on');
    });

    it('updates lastReported when off -> off at same timestamp', async () => {
      mockDevice.getLatestEvent.mockResolvedValue(mockEventOff);
      const sameTimestamp = new Date('2024-01-15T00:00:00Z');

      const result = await setBooleanProperty(
        mockDevice as unknown as Device,
        'isOn',
        false,
        sameTimestamp
      );

      expect(mockEventOff.save).toHaveBeenCalled();
      expect(mockEventOff.destroy).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
