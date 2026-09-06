import express from 'express';
import { Device } from '../../models';
import { getPreWarmStartTime } from '../../automations/heating-warmup';
import { HeatingUpdateRequest, HeatingStatusResponse, CentralHeatingMode, ApiErrorResponse } from '../../api/types';

const router = express.Router();

async function getHeatPumpCapability() {
  return (await Device.findByCapability('HEAT_PUMP'))[0].getHeatPumpCapability();
}

async function buildHeatingStatus(): Promise<HeatingStatusResponse> {
  const [heatPump, thermostatDevices] = await Promise.all([
    getHeatPumpCapability(),
    Device.findByCapability('THERMOSTAT')
  ]);

  const [dhwMode, dhwBoost] = await Promise.all([
    heatPump.getDHWMode(),
    heatPump.getDHWBoost()
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

  return {
    centralHeating,
    dhwStatus: {
      mode: dhwMode,
      isBoosting: dhwBoost
    },
    preWarmStartTime: preWarmStartTime?.toISOString() ?? null
  };
}

router.get<Record<string, never>, HeatingStatusResponse>('/', async (_req, res) => {
  res.json(await buildHeatingStatus());
});

router.put<Record<string, never>, HeatingStatusResponse | ApiErrorResponse, HeatingUpdateRequest>('/', async (req, res) => {
  const { centralHeating, dhw, dhwBoost } = req.body;

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
    if (!['OFF', 'AUTO'].includes(dhw)) {
      res.status(400).json({ error: 'Invalid dhw mode. Must be OFF or AUTO.' });
      return;
    }

    await (await getHeatPumpCapability()).setDHWMode(dhw);
  }

  if (dhwBoost !== undefined) {
    await (await getHeatPumpCapability()).setDHWBoost(dhwBoost);
  }

  res.status(200).json(await buildHeatingStatus());
});

export default router;
