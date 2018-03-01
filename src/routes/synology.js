import express from 'express';
import asyncWrapper from "../helpers/express-async-wrapper";
import moment from 'moment';
import bus, { MOTION_DETECTED } from '../bus';

const router = express.Router();

router.get('/motion', asyncWrapper(async (req, res) => {
  bus.emit(MOTION_DETECTED, {
    camera: req.query.camera,
    time: moment()
  });

  res.sendStatus(200);
}));

export default router;