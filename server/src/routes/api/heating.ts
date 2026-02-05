import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Device } from '../../models';
import { setDHWMode, getDHWMode } from '../../services/ebusd';
import { getPreWarmStartTime } from '../../automations/heating-warmup';
import { HeatingUpdateRequest, HeatingStatusResponse, CentralHeatingMode } from '../../api/types';

const router = express.Router();

router.get<Record<string, never>, HeatingStatusResponse>('/', asyncWrapper(async (_req, res) => {
  const [dhwIsOn, thermostatDevices] = await Promise.all([
    getDHWMode(),
    Device.findByCapability('THERMOSTAT')
  ]);

  const thermostatData = await Promise.all(
    thermostatDevices.map(async device => {
      const thermostat = device.getThermostatCapability();
      const [targetTemperature, setbackTemperature] = await Promise.all([
        thermostat.getTargetTemperature(),
        thermostat.getSetbackTemperature()
      ]);
      return { targetTemperature, setbackTemperature };
    })
  );

  const centralHeating = thermostatData.reduce<CentralHeatingMode | null>((mode, curr, currIndex) => {
    if (mode === null && currIndex !== 0) return null;

    const { targetTemperature, setbackTemperature } = curr;
    const currMode = (() => {
      if (targetTemperature === 0) {
        return 'OFF';
      }

      if (targetTemperature === setbackTemperature) {
        return 'SETBACK';
      }

      return 'ON';
    })();

    return mode === null || mode === currMode ? currMode : null;
  }, null);

  const preWarmStartTime = getPreWarmStartTime();

  res.json({
    centralHeating,
    dhw: dhwIsOn ? 'ON' : 'OFF',
    preWarmStartTime: preWarmStartTime?.toISOString() ?? null
  });
}));

router.put<Record<string, never>, void, HeatingUpdateRequest>('/', asyncWrapper(async (req, res) => {
  const { centralHeating, dhw } = req.body;

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
        case 'SETBACK': {
          const setbackTemp = await thermostat.getSetbackTemperature();
          await thermostat.setTargetTemperature(setbackTemp);
          break;
        }
      }
    }
  }

  if (dhw !== undefined) {
    if (!['ON', 'OFF'].includes(dhw)) {
      res.status(400).json({ error: 'Invalid dhw mode. Must be ON or OFF.' });
      return;
    }

    await setDHWMode(dhw === 'ON');
  }

  res.status(204).send();
}));

export default router;
