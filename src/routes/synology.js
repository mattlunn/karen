import express from 'express';
import asyncWrapper from "../helpers/express-async-wrapper";
import moment from 'moment';
import { onMotionDetected } from '../services/synology';

const router = express.Router();

router.get('/motion', asyncWrapper(async (req, res) => {
  onMotionDetected(req.query.camera, moment());
  res.sendStatus(200);
}));

export default router;