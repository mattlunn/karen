import express from 'express';
import asyncWrapper from "../helpers/express-async-wrapper";
import bus, { MOTION_DETECTED } from '../bus';

const router = express.Router();

router.get('/motion', asyncWrapper(async (req, res) => {
  bus.emit(MOTION_DETECTED);
  res.sendStatus(200);
}));

export default router;