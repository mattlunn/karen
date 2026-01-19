import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Device, Room } from '../../models';
import { Capability } from '../../models/capabilities';
import {
  RestCapabilityData,
  RestDeviceResponse,
  HomeRoom,
  HomeCamera,
  DevicesApiResponse
} from '../../api/types';

const router = express.Router();

async function getCapabilityData(device: Device, capability: Capability): Promise<RestCapabilityData> {
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

  const cameras: HomeCamera[] = allDevices
    .filter(device => device.type === 'camera')
    .map(device => ({
      id: device.id,
      name: device.name,
      snapshotUrl: `/api/snapshot/${device.providerId}`
    }));

  const response: DevicesApiResponse = {
    rooms,
    devices,
    cameras
  };

  res.json(response);
}));

export default router;
