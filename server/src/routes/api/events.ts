import express from 'express';
import bus from '../../bus';
import type { NumericEvent, BooleanEvent } from '../../models';

const router = express.Router();

interface SSEClient {
  id: string;
  response: express.Response;
}

const clients: Set<SSEClient> = new Set();

router.get('/events', (req, res) => {
  // Authentication check - uses existing session cookie
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Generate client ID
  const clientId = `${Date.now()}-${Math.random()}`;
  const client: SSEClient = { id: clientId, response: res };

  clients.add(client);
  console.log(`SSE client connected: ${clientId} (${clients.size} total)`);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Heartbeat to keep connection alive (every 30s)
  const heartbeat = setInterval(() => {
    try {
      res.write(':heartbeat\n\n');
    } catch (err) {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Generic device capability event handler
  // Based on the bus.ts DeviceCapabilityEvent pattern
  const createDeviceEventHandler = (capability: string, field: string) => {
    return (event: NumericEvent | BooleanEvent) => {
      // Events from the bus have deviceId, value, start, end properties
      const deviceId = (event as any).deviceId;

      if (!deviceId) {
        console.warn('Received event without deviceId:', event);
        return;
      }

      const message = {
        type: 'device_update',
        deviceId,
        capability,
        field,
        value: event.value,
        start: event.start.toISOString(),
        end: event.end?.toISOString() || null,
      };

      // Send to all connected clients
      clients.forEach(client => {
        try {
          client.response.write(`data: ${JSON.stringify(message)}\n\n`);
        } catch (err) {
          console.error(`Failed to send to client ${client.id}:`, err);
          clients.delete(client);
        }
      });
    };
  };

  // Listen to all device capability events
  // Pattern: {CAPABILITY}:{field}:start
  const eventHandlers: Array<{ pattern: string; handler: (event: any) => void }> = [
    // LIGHT capability events
    { pattern: 'LIGHT:isOn:start', handler: createDeviceEventHandler('LIGHT', 'isOn') },
    { pattern: 'LIGHT:brightness:start', handler: createDeviceEventHandler('LIGHT', 'brightness') },

    // LOCK capability events
    { pattern: 'LOCK:isLocked:start', handler: createDeviceEventHandler('LOCK', 'isLocked') },
    { pattern: 'LOCK:isJammed:start', handler: createDeviceEventHandler('LOCK', 'isJammed') },

    // THERMOSTAT capability events
    { pattern: 'THERMOSTAT:targetTemperature:start', handler: createDeviceEventHandler('THERMOSTAT', 'targetTemperature') },
    { pattern: 'THERMOSTAT:currentTemperature:start', handler: createDeviceEventHandler('THERMOSTAT', 'currentTemperature') },
    { pattern: 'THERMOSTAT:isHeating:start', handler: createDeviceEventHandler('THERMOSTAT', 'isHeating') },
    { pattern: 'THERMOSTAT:power:start', handler: createDeviceEventHandler('THERMOSTAT', 'power') },

    // SWITCH capability events
    { pattern: 'SWITCH:isOn:start', handler: createDeviceEventHandler('SWITCH', 'isOn') },

    // MOTION_SENSOR capability events
    { pattern: 'MOTION_SENSOR:hasMotion:start', handler: createDeviceEventHandler('MOTION_SENSOR', 'hasMotion') },

    // TEMPERATURE_SENSOR capability events
    { pattern: 'TEMPERATURE_SENSOR:currentTemperature:start', handler: createDeviceEventHandler('TEMPERATURE_SENSOR', 'currentTemperature') },

    // HUMIDITY_SENSOR capability events
    { pattern: 'HUMIDITY_SENSOR:humidity:start', handler: createDeviceEventHandler('HUMIDITY_SENSOR', 'humidity') },

    // LIGHT_SENSOR capability events
    { pattern: 'LIGHT_SENSOR:illuminance:start', handler: createDeviceEventHandler('LIGHT_SENSOR', 'illuminance') },

    // BATTERY_LEVEL_INDICATOR capability events
    { pattern: 'BATTERY_LEVEL_INDICATOR:batteryPercentage:start', handler: createDeviceEventHandler('BATTERY_LEVEL_INDICATOR', 'batteryPercentage') },

    // BATTERY_LOW_INDICATOR capability events
    { pattern: 'BATTERY_LOW_INDICATOR:isLow:start', handler: createDeviceEventHandler('BATTERY_LOW_INDICATOR', 'isLow') },
  ];

  // Register all event listeners
  eventHandlers.forEach(({ pattern, handler }) => {
    bus.on(pattern, handler);
  });

  // User arrival/departure event handler
  const userEventHandler = (stay: any) => {
    const message = {
      type: 'user_update',
      userId: stay.userId,
      status: stay.status,
      since: stay.since,
      until: stay.until,
    };

    clients.forEach(client => {
      try {
        client.response.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (err) {
        console.error(`Failed to send to client ${client.id}:`, err);
        clients.delete(client);
      }
    });
  };

  // Listen to user events
  bus.on('STAY_START', userEventHandler);
  bus.on('STAY_END', userEventHandler);
  bus.on('FIRST_USER_HOME', userEventHandler);
  bus.on('LAST_USER_LEAVES', userEventHandler);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);

    // Remove all event listeners
    eventHandlers.forEach(({ pattern, handler }) => {
      bus.off(pattern, handler);
    });

    // Remove user event listeners
    bus.off('STAY_START', userEventHandler);
    bus.off('STAY_END', userEventHandler);
    bus.off('FIRST_USER_HOME', userEventHandler);
    bus.off('LAST_USER_LEAVES', userEventHandler);

    clients.delete(client);
    console.log(`SSE client disconnected: ${clientId} (${clients.size} remaining)`);
    res.end();
  });
});

export default router;
