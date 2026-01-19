import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Device } from '../../models';
import { setDHWMode, getDHWMode } from '../../services/ebusd';
import {
  CentralHeatingMode,
  DHWHeatingMode,
  CentralHeatingUpdateRequest,
  CentralHeatingResponse,
  DHWHeatingUpdateRequest,
  DHWHeatingResponse
} from '../../api/types';

const router = express.Router();

router.put<Record<string, never>, CentralHeatingResponse, CentralHeatingUpdateRequest>('/central', asyncWrapper(async (req, res) => {
  const mode = req.body.mode;

  if (!['ON', 'OFF', 'SETBACK'].includes(mode)) {
    res.status(400).json({ error: 'Invalid mode. Must be ON, OFF, or SETBACK.' });
    return;
  }

  const devices = await Device.findByCapability('THERMOSTAT');

  for (const device of devices) {
    const thermostat = device.getThermostatCapability();

    switch (mode) {
      case 'OFF':
        await thermostat.setIsOn(false);
        break;
      case 'ON':
        await thermostat.setIsOn(true);
        break;
      case 'SETBACK':
        const setbackTemp = await thermostat.getSetbackTemperature();
        await thermostat.setTargetTemperature(setbackTemp);
        break;
    }
  }

  const thermostats = await Promise.all(
    devices.map(async device => {
      const thermostat = device.getThermostatCapability();
      const [targetTemperature, setbackTemperature, isHeating] = await Promise.all([
        thermostat.getTargetTemperature(),
        thermostat.getSetbackTemperature(),
        thermostat.getIsOn()
      ]);

      return {
        id: device.id,
        targetTemperature,
        setbackTemperature,
        isHeating
      };
    })
  );

  res.json({
    mode,
    thermostats
  });
}));

router.put<Record<string, never>, DHWHeatingResponse, DHWHeatingUpdateRequest>('/dhw', asyncWrapper(async (req, res) => {
  const mode = req.body.mode;

  if (!['ON', 'OFF'].includes(mode)) {
    res.status(400).json({ error: 'Invalid mode. Must be ON or OFF.' });
    return;
  }

  // setDHWMode has incorrect type signature (only accepts true but works with false too)
  await setDHWMode((mode === 'ON') as unknown as true);

  res.json({
    dhwHeatingMode: mode
  });
}));

router.get<Record<string, never>, DHWHeatingResponse>('/dhw', asyncWrapper(async (req, res) => {
  const isOn = await getDHWMode();

  res.json({
    dhwHeatingMode: isOn ? 'ON' : 'OFF'
  });
}));

export default router;
