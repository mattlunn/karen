import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { User, Stay, Device, Arming } from '../../models';
import { getDHWMode } from '../../services/ebusd';
import {
  UserStatus,
  SidebarUser,
  SidebarThermostat,
  SidebarApiResponse,
  AlarmMode
} from '../../api/types';

const router = express.Router();

router.get<Record<string, never>, SidebarApiResponse>('/', asyncWrapper(async (req, res) => {
  const users = await User.findAll();
  const userIds = users.map(u => u.id);

  const [currentOrLastStays, upcomingStays, activeArming, dhwMode, thermostatDevices] = await Promise.all([
    Stay.findCurrentOrLastStays(userIds),
    Stay.findUpcomingStays(userIds),
    Arming.getActiveArming(),
    getDHWMode(),
    Device.findByCapability('THERMOSTAT')
  ]);

  const currentStaysByUserId = new Map<number, Stay>();
  for (const stay of currentOrLastStays) {
    if (stay && stay.userId !== null) {
      currentStaysByUserId.set(stay.userId as number, stay);
    }
  }

  const upcomingStaysByUserId = new Map<number, Stay>();
  for (const stay of upcomingStays) {
    if (stay && stay.userId !== null) {
      upcomingStaysByUserId.set(stay.userId as number, stay);
    }
  }

  const sidebarUsers: SidebarUser[] = users.map(user => {
    const currentOrLast = currentStaysByUserId.get(user.id);
    const upcoming = upcomingStaysByUserId.get(user.id);

    const isAway = upcoming || currentOrLast?.departure;
    const status: UserStatus = isAway ? 'AWAY' : 'HOME';

    const since = isAway
      ? (currentOrLast?.departure ? +currentOrLast.departure : 0)
      : (currentOrLast?.arrival ? +currentOrLast.arrival : 0);

    const until = isAway && upcoming?.eta ? +upcoming.eta : null;

    return {
      id: user.handle,
      avatar: user.avatar,
      status,
      since,
      until
    };
  });

  const thermostats: SidebarThermostat[] = await Promise.all(
    thermostatDevices.map(async device => {
      const thermostat = device.getThermostatCapability();
      const [targetTemperature, setbackTemperature] = await Promise.all([
        thermostat.getTargetTemperature(),
        thermostat.getSetbackTemperature()
      ]);

      return {
        id: device.id,
        targetTemperature,
        setbackTemperature
      };
    })
  );

  res.json({
    users: sidebarUsers,
    security: {
      alarmMode: activeArming ? activeArming.mode as AlarmMode : 'OFF'
    },
    heating: {
      dhwHeatingMode: dhwMode ? 'ON' : 'OFF',
      thermostats
    }
  });
}));

export default router;
