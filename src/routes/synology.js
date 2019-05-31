import express from 'express';
import asyncWrapper from "../helpers/express-async-wrapper";
import moment from 'moment';
import { onMotionDetected } from '../services/synology';
import { enqueueWorkItem } from '../queue';

const router = express.Router();

router.get('/motion', asyncWrapper(async (req, res) => {
  const now = moment();

  enqueueWorkItem(() => onMotionDetected(req.query.camera_id, now));
  res.sendStatus(200);
}));

export default router;