import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Device } from '../../models';
import { Capability } from '../../models/capabilities';

const router = express.Router();

interface CapabilityData {
  type: string;
  [key: string]: unknown;
}

interface DeviceResponse {
  id: number;
  name: string;
  status: 'OK' | 'OFFLINE';
  capabilities: CapabilityData[];
}

interface DevicesApiResponse {
  devices: DeviceResponse[];
}

async function getCapabilityData(device: Device, capability: Capability): Promise<CapabilityData> {
  switch (capability) {
    case 'CAMERA':
      return {
        type: 'CAMERA',
        snapshotUrl: `/api/snapshot/${device.providerId}`
      };

    case 'LIGHT_SENSOR': {
      const sensor = device.getLightSensorCapability();
      return {
        type: 'LIGHT_SENSOR',
        illuminance: await sensor.getIlluminance()
      };
    }

    case 'HUMIDITY_SENSOR': {
      const sensor = device.getHumiditySensorCapability();
      return {
        type: 'HUMIDITY_SENSOR',
        humidity: await sensor.getHumidity()
      };
    }

    case 'LIGHT': {
      const light = device.getLightCapability();
      const [isOn, brightness] = await Promise.all([
        light.getIsOn(),
        light.getBrightness()
      ]);
      return {
        type: 'LIGHT',
        isOn,
        brightness
      };
    }

    case 'HEAT_PUMP': {
      const heatPump = device.getHeatPumpCapability();
      const [mode, dailyConsumedEnergy, heatingCoP, compressorModulation, dhwTemperature] = await Promise.all([
        heatPump.getMode(),
        heatPump.getDailyConsumedEnergy(),
        heatPump.getHeatingCoP(),
        heatPump.getCompressorModulation(),
        heatPump.getDHWTemperature()
      ]);
      return {
        type: 'HEAT_PUMP',
        mode,
        dailyConsumedEnergy,
        heatingCoP,
        compressorModulation,
        dhwTemperature
      };
    }

    case 'LOCK': {
      const lock = device.getLockCapability();
      return {
        type: 'LOCK',
        isLocked: await lock.getIsLocked()
      };
    }

    case 'MOTION_SENSOR': {
      const sensor = device.getMotionSensorCapability();
      return {
        type: 'MOTION_SENSOR',
        motionDetected: await sensor.getHasMotion()
      };
    }

    case 'TEMPERATURE_SENSOR': {
      const sensor = device.getTemperatureSensorCapability();
      return {
        type: 'TEMPERATURE_SENSOR',
        currentTemperature: await sensor.getCurrentTemperature()
      };
    }

    case 'THERMOSTAT': {
      const thermostat = device.getThermostatCapability();
      const [targetTemperature, currentTemperature, isHeating, power] = await Promise.all([
        thermostat.getTargetTemperature(),
        thermostat.getCurrentTemperature(),
        thermostat.getIsOn(),
        thermostat.getPower()
      ]);
      return {
        type: 'THERMOSTAT',
        targetTemperature,
        currentTemperature,
        isHeating,
        power
      };
    }

    case 'SPEAKER':
      return { type: 'SPEAKER' };

    case 'SWITCH': {
      const switchCapability = device.getSwitchCapability();
      return {
        type: 'SWITCH',
        isOn: await switchCapability.getIsOn()
      };
    }

    case 'BATTERY_LEVEL_INDICATOR': {
      const battery = device.getBatteryLevelIndicatorCapability();
      return {
        type: 'BATTERY_LEVEL_INDICATOR',
        batteryPercentage: await battery.getBatteryPercentage()
      };
    }

    case 'BATTERY_LOW_INDICATOR': {
      const battery = device.getBatteryLowIndicatorCapability();
      return {
        type: 'BATTERY_LOW_INDICATOR',
        isLow: await battery.getIsBatteryLow()
      };
    }

    default:
      return { type: capability };
  }
}

router.get('/', asyncWrapper(async (req, res) => {
  const allDevices = await Device.findAll();

  const devices: DeviceResponse[] = await Promise.all(
    allDevices.map(async device => {
      const capabilities = device.getCapabilities();
      const capabilityData = await Promise.all(
        capabilities.map(cap => getCapabilityData(device, cap))
      );
      const isConnected = await device.getIsConnected();

      return {
        id: device.id,
        name: device.name,
        status: isConnected ? 'OK' : 'OFFLINE',
        capabilities: capabilityData
      };
    })
  );

  const response: DevicesApiResponse = { devices };

  res.json(response);
}));

export default router;
