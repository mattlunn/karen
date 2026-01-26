import express from 'express';
import bus from '../../bus';
import type { NumericEvent, BooleanEvent, Device } from '../../models';
import { DeviceCapabilityEvents, type DeviceCapabilityEvent } from '../../models/capabilities';
import { mapDeviceToResponse } from './device-helpers';

const router = express.Router();

interface SSEClient {
  response: express.Response;
}

const clients: Set<SSEClient> = new Set();

router.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  const client = { response: res };
  clients.add(client);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Heartbeat to keep connection alive (every 30s)
  const heartbeat = setInterval(() => {
    try {
      res.write(':heartbeat\n\n');
    } catch (err) {
      clearInterval(heartbeat);
    }
  }, 30000);

  const handleDeviceCapabilityPropertyChanged = async (e: NumericEvent | BooleanEvent) => {
    const message = {
      type: 'device_update',
      device: await mapDeviceToResponse(await e.getDevice())
    };

    // Send to all connected clients
    clients.forEach(client => {
      try {
        client.response.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (err) {
        console.error('Failed to send SSE message to client:', err);
        clients.delete(client);
      }
    });
  };

  DeviceCapabilityEvents.onDeviceCapabilityPropertyChanged(handleDeviceCapabilityPropertyChanged);

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
        console.error('Failed to send SSE message to client:', err);
        clients.delete(client);
      }
    });
  };

  bus.on('STAY_START', userEventHandler);
  bus.on('STAY_END', userEventHandler);

  req.on('close', () => {
    clearInterval(heartbeat);

    DeviceCapabilityEvents.offDeviceCapabilityPropertyChanged(handleDeviceCapabilityPropertyChanged);

    bus.off('STAY_START', userEventHandler);
    bus.off('STAY_END', userEventHandler);
    
    clients.delete(client);
    res.end();
  });
});

export default router;
