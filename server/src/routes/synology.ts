import express from 'express';
import asyncWrapper from "../helpers/express-async-wrapper";
import { dayjs } from '../dayjs';
import config from '../config';
import { onMotionDetected, onDoorbellRing } from '../services/synology';

const router = express.Router();

router.use((req, res, next) => {
  if (req.query.secret !== config.synology.secret) {
    return res.sendStatus(401).end();
  } else {
    next();
  }
});

router.get('/motion', asyncWrapper(async (req, res) => {
  const now = dayjs();
  const { camera_id } = req.query;

  if (typeof camera_id === 'string') {
    await onMotionDetected(camera_id, now);
  }
  
  res.sendStatus(200);
}));

router.get('/ring', asyncWrapper(async (req, res) => {
  const { camera_id } = req.query;

  if (typeof camera_id === 'string') {
    await onDoorbellRing(camera_id);
    res.sendStatus(202);
  } else {
    return res.sendStatus(400);
  }
}));

export default router;