import express from 'express';
import asyncWrapper from "../helpers/express-async-wrapper";
import moment from 'moment';
import { onMotionDetected, onDoorbellRing } from '../services/synology';

const router = express.Router();

router.get('/motion', asyncWrapper(async (req, res) => {
  const now = moment();
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
  }

  return res.sendStatus(400);
}));

export default router;