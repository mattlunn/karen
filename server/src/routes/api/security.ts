import express from 'express';
import asyncWrapper from '../../helpers/express-async-wrapper';
import { Arming } from '../../models';
import { ArmingMode } from '../../models/arming';
import { AlarmMode, AlarmStatusResponse, AlarmUpdateRequest } from '../../api/types';

const router = express.Router();

router.get<Record<string, never>, AlarmStatusResponse>('/alarm', asyncWrapper(async (req, res) => {
  const activeArming = await Arming.getActiveArming();

  res.json({
    alarmMode: activeArming ? activeArming.mode as AlarmMode : 'OFF'
  });
}));

router.put<Record<string, never>, void, AlarmUpdateRequest>('/alarm', asyncWrapper(async (req, res) => {
  const desiredMode = req.body.mode;

  if (!['OFF', 'AWAY', 'NIGHT'].includes(desiredMode)) {
    res.status(400).json({ error: 'Invalid alarm mode. Must be OFF, AWAY, or NIGHT.' });
    return;
  }

  const currentArming = await Arming.getActiveArming();
  const now = new Date();

  if ((currentArming === null && desiredMode === 'OFF') || currentArming?.mode === desiredMode) {
    res.status(204).send();
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

  res.status(204).send();
}));

export default router;
