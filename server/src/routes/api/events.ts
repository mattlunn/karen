import express from 'express';
import bus from '../../bus';
import type { NumericEvent, BooleanEvent } from '../../models';
import type { DeviceCapabilityEvent } from '../../models/capabilities';

const router = express.Router();

interface SSEClient {
  id: string;
  response: express.Response;
}

const clients: Set<SSEClient> = new Set();

router.get('/', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
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
  // Uses DeviceCapabilityEvent patterns from capabilities.gen.ts
  const eventHandlers: Array<{ event: DeviceCapabilityEvent; handler: (event: any) => void }> = [
    // LIGHT capability events
    { event: 'ON_LIGHT_IS_ON_START', handler: createDeviceEventHandler('LIGHT', 'isOn') },
    { event: 'ON_LIGHT_BRIGHTNESS_CHANGED', handler: createDeviceEventHandler('LIGHT', 'brightness') },

    // LOCK capability events
    { event: 'ON_LOCK_IS_LOCKED_START', handler: createDeviceEventHandler('LOCK', 'isLocked') },
    { event: 'ON_LOCK_IS_JAMMED_START', handler: createDeviceEventHandler('LOCK', 'isJammed') },

    // THERMOSTAT capability events
    { event: 'ON_THERMOSTAT_TARGET_TEMPERATURE_CHANGED', handler: createDeviceEventHandler('THERMOSTAT', 'targetTemperature') },
    { event: 'ON_THERMOSTAT_CURRENT_TEMPERATURE_CHANGED', handler: createDeviceEventHandler('THERMOSTAT', 'currentTemperature') },
    { event: 'ON_THERMOSTAT_IS_ON_START', handler: createDeviceEventHandler('THERMOSTAT', 'isHeating') },
    { event: 'ON_THERMOSTAT_POWER_CHANGED', handler: createDeviceEventHandler('THERMOSTAT', 'power') },

    // SWITCH capability events
    { event: 'ON_SWITCH_IS_ON_START', handler: createDeviceEventHandler('SWITCH', 'isOn') },

    // MOTION_SENSOR capability events
    { event: 'ON_MOTION_SENSOR_HAS_MOTION_START', handler: createDeviceEventHandler('MOTION_SENSOR', 'hasMotion') },

    // TEMPERATURE_SENSOR capability events
    { event: 'ON_TEMPERATURE_SENSOR_CURRENT_TEMPERATURE_CHANGED', handler: createDeviceEventHandler('TEMPERATURE_SENSOR', 'currentTemperature') },

    // HUMIDITY_SENSOR capability events
    { event: 'ON_HUMIDITY_SENSOR_HUMIDITY_CHANGED', handler: createDeviceEventHandler('HUMIDITY_SENSOR', 'humidity') },

    // LIGHT_SENSOR capability events
    { event: 'ON_LIGHT_SENSOR_ILLUMINANCE_CHANGED', handler: createDeviceEventHandler('LIGHT_SENSOR', 'illuminance') },

    // BATTERY_LEVEL_INDICATOR capability events
    { event: 'ON_BATTERY_LEVEL_INDICATOR_BATTERY_PERCENTAGE_CHANGED', handler: createDeviceEventHandler('BATTERY_LEVEL_INDICATOR', 'batteryPercentage') },

    // BATTERY_LOW_INDICATOR capability events
    { event: 'ON_BATTERY_LOW_INDICATOR_IS_BATTERY_LOW_START', handler: createDeviceEventHandler('BATTERY_LOW_INDICATOR', 'isLow') },
  ];

  // Register all event listeners
  eventHandlers.forEach(({ event, handler }) => {
    bus.on(event, handler);
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
    eventHandlers.forEach(({ event, handler }) => {
      bus.off(event, handler);
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
