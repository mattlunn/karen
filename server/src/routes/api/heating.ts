import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Device } from '../../models';
import { setDHWMode } from '../../services/ebusd';
import { HeatingUpdateRequest, HeatingResponse } from '../../api/types';

const router = express.Router();

router.put<Record<string, never>, HeatingResponse, HeatingUpdateRequest>('/', asyncWrapper(async (req, res) => {
  const { centralHeating, dhw } = req.body;
  const response: HeatingResponse = {};

  if (centralHeating !== undefined) {
    if (!['ON', 'OFF', 'SETBACK'].includes(centralHeating)) {
      res.status(400).json({ error: 'Invalid centralHeating mode. Must be ON, OFF, or SETBACK.' });
      return;
    }

    const devices = await Device.findByCapability('THERMOSTAT');

    for (const device of devices) {
      const thermostat = device.getThermostatCapability();

      switch (centralHeating) {
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

    response.thermostats = await Promise.all(
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
  }

  if (dhw !== undefined) {
    if (!['ON', 'OFF'].includes(dhw)) {
      res.status(400).json({ error: 'Invalid dhw mode. Must be ON or OFF.' });
      return;
    }

    await setDHWMode(dhw === 'ON');
    response.dhwHeatingMode = dhw;
  }

  res.json(response);
}));

export default router;
