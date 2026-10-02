import express from 'express';
import { Device, Room } from '../../models';
import {
  RestDeviceResponse,
  BrokenDeviceResponse,
  HomeRoom,
  DevicesApiResponse
} from '../../api/types';
import { mapDeviceToResponse } from './device-helpers';
import logger from '../../logger';

const router = express.Router();

router.get<Record<string, never>, DevicesApiResponse>('/', async (req, res) => {
  const [allDevices, allRooms] = await Promise.all([
    Device.findAll(),
    Room.findAll()
  ]);

  const devices: RestDeviceResponse[] = [];
  const brokenDevices: BrokenDeviceResponse[] = [];
  const rooms: HomeRoom[] = allRooms
    .sort((a, b) => (a.displayWeight ?? 0) - (b.displayWeight ?? 0))
    .map(room => ({
      id: room.id as number,
      name: room.name,
      displayIconName: room.displayIconName,
      displayWeight: room.displayWeight
    }));

  await Promise.all(
    allDevices.map((device) => {
      return mapDeviceToResponse(device).then((device) => {
        devices.push(device);
      }).catch((e) => {
        logger.error(e, `Failed to map ${device.provider} device with ID ${device.id} (${device.name})`);

        brokenDevices.push({
          id: device.id,
          name: device.name,
          provider: device.provider,
          providerId: device.providerId
        });
      });
    })
  );

  res.json({
    rooms,
    devices,
    brokenDevices
  });
});

export default router;
