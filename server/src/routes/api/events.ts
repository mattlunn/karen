import express from 'express';
import type { NumericEvent, BooleanEvent } from '../../models';
import { DeviceCapabilityEvents } from '../../models/capabilities';
import { mapDeviceToResponse } from './device-helpers';
import logger from '../../logger';
import { SSEEvent } from '../../api/types';

const router = express.Router();

interface SSEClient {
  response: express.Response;
}

const clients: Set<SSEClient> = new Set();

function sendMessage(client: SSEClient, message: SSEEvent) {
  try {
    client.response.write(`data: ${JSON.stringify(message)}\n\n`);
  } catch (err) {
    logger.error('Failed to send SSE message to client:', err);
    clients.delete(client);
  }
}

router.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  const client = { response: res };
  clients.add(client);

  sendMessage(client, { type: 'connected' });

  const handleDeviceCapabilityPropertyChanged = async (e: NumericEvent | BooleanEvent) => {
    const message = {
      type: 'device_update' as const,
      device: await mapDeviceToResponse(await e.getDevice())
    };

    clients.forEach(client => sendMessage(client, message));
  };

  DeviceCapabilityEvents.onDeviceCapabilityPropertyChanged(handleDeviceCapabilityPropertyChanged);

  const heartbeat = setInterval(() => {
    try {
      res.write(':heartbeat\n\n');
    } catch (err) {
      cleanup();
    }
  }, 30000);

  const cleanup = () => {
    clearInterval(heartbeat);

    DeviceCapabilityEvents.offDeviceCapabilityPropertyChanged(handleDeviceCapabilityPropertyChanged);

    clients.delete(client);
  };

  req.on('close', () => {
    cleanup();
    res.end();
  });
});

export default router;
