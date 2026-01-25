import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Device, Room } from '../../models';
import {
  RestDeviceResponse,
  HomeRoom,
  DevicesApiResponse
} from '../../api/types';
import { mapDeviceToResponse } from './device-helpers';
import logger from '../../logger';

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

  const devices: RestDeviceResponse[] = (await Promise.all(
    allDevices.map(device => mapDeviceToResponse(device).catch((e) => {
      logger.error(e, `Failed to map ${device.provider} device with ID ${device.id} (${device.name})`);

      return null;
    }))
  )).filter(x => !!x);

  res.json({
    rooms,
    devices
  });
}));

export default router;
