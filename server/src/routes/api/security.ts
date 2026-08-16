import express from 'express';
import { Arming } from '../../models';
import { ArmingMode } from '../../models/arming';
import { AlarmMode, AlarmStatusResponse, AlarmUpdateRequest, ApiErrorResponse } from '../../api/types';
import { asyncMap } from '../../helpers/array';

const router = express.Router();

async function getAlarmStatus(): Promise<AlarmStatusResponse> {
  const activeArming = await Arming.getActiveArming();

  if (!activeArming) {
    return { alarmMode: 'OFF', start: null, activations: [] };
  }

  const activationRows = await activeArming.getAlarmActivations();

  const activations = await asyncMap(activationRows, async (activation) => {
    const triggeringDevice = await activation.getTriggeringDevice();

    return {
      id: activation.id,
      startedAt: activation.startedAt.toISOString(),
      suppressFurtherAlertsUntil: activation.suppressFurtherAlertsUntil.toISOString(),
      triggeringDevice: { id: triggeringDevice.id, name: triggeringDevice.name }
    };
  });

  return {
    alarmMode: activeArming.mode as AlarmMode,
    start: activeArming.start.toISOString(),
    activations
  };
}

router.get<Record<string, never>, AlarmStatusResponse>('/', async (req, res) => {
  res.json(await getAlarmStatus());
});

router.put<Record<string, never>, AlarmStatusResponse | ApiErrorResponse, AlarmUpdateRequest>('/', async (req, res) => {
  const desiredMode = req.body.alarmMode;

  if (!['OFF', 'AWAY', 'NIGHT'].includes(desiredMode)) {
    res.status(400).json({ error: 'Invalid alarm mode. Must be OFF, AWAY, or NIGHT.' });
    return;
  }

  const currentArming = await Arming.getActiveArming();
  const now = new Date();

  if ((currentArming === null && desiredMode === 'OFF') || currentArming?.mode === desiredMode) {
    res.json(await getAlarmStatus());
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

  res.json(await getAlarmStatus());
});

export default router;
