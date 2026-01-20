import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Device, Room } from '../../models';
import { Capability } from '../../models/capabilities';
import {
  CapabilityApiResponse,
  RestDeviceResponse,
  HomeRoom,
  DevicesApiResponse
} from '../../api/types';
import { getCapabilityData } from './device-helpers';

const router = express.Router();

router.get<Record<string, never>, DevicesApiResponse>('/', asyncWrapper(async (req, res) => {
  const [allDevices, allRooms] = await Promise.all([
    Device.findAll(),
    Room.findAll()
  ]);

  const rooms: HomeRoom[] = allRooms
    .sort((a, b) => ((a.displayWeight as number | null) ?? 0) - ((b.displayWeight as number | null) ?? 0))
    .map(room => ({
      id: room.id as number,
      name: room.name,
      displayIconName: room.displayIconName as string | null,
      displayWeight: room.displayWeight as number | null
    }));

  const devices: RestDeviceResponse[] = await Promise.all(
    allDevices.map(async device => {
      const capabilities = device.getCapabilities();
      const [capabilityData, isConnected] = await Promise.all([
        Promise.all(capabilities.map(cap => getCapabilityData(device, cap))),
        device.getIsConnected()
      ]);

      return {
        id: device.id,
        name: device.name,
        roomId: device.roomId,
        status: isConnected ? 'OK' : 'OFFLINE',
        capabilities: capabilityData
      };
    })
  );

  res.json({
    rooms,
    devices
  });
}));

export default router;
