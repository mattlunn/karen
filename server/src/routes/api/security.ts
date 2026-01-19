import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Arming } from '../../models';
import { ArmingMode } from '../../models/arming';
import { AlarmMode, AlarmStatusResponse } from '../../api/types';

const router = express.Router();

router.get('/alarm', asyncWrapper(async (req, res) => {
  const activeArming = await Arming.getActiveArming();

  const response: AlarmStatusResponse = {
    alarmMode: activeArming ? activeArming.mode as AlarmMode : 'OFF'
  };

  res.json(response);
}));

router.put('/alarm', asyncWrapper(async (req, res) => {
  const desiredMode = req.body.mode as AlarmMode;

  if (!['OFF', 'AWAY', 'NIGHT'].includes(desiredMode)) {
    res.status(400).json({ error: 'Invalid alarm mode. Must be OFF, AWAY, or NIGHT.' });
    return;
  }

  const currentArming = await Arming.getActiveArming();
  const now = new Date();

  if ((currentArming === null && desiredMode === 'OFF') || currentArming?.mode === desiredMode) {
    const response: AlarmStatusResponse = {
      alarmMode: desiredMode
    };
    res.json(response);
    return;
  }

  if (currentArming !== null) {
    currentArming.end = now;
    await currentArming.save();
  }

  if (desiredMode !== 'OFF') {
    await Arming.create({
      start: now,
      mode: desiredMode === 'AWAY' ? ArmingMode.AWAY : ArmingMode.NIGHT
    });
  }

  const response: AlarmStatusResponse = {
    alarmMode: desiredMode
  };

  res.json(response);
}));

export default router;
