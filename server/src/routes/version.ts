import { Router } from 'express';
import { BUILD_VERSION } from '../helpers/build-version';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ version: BUILD_VERSION });
});

export default router;
