import { Router } from 'express';
import { getPanel } from '../services/eink/registry';

const router = Router();

router.get('/:panelId.png', (req, res) => {
  const panel = getPanel(req.params.panelId);

  if (!panel) {
    res.sendStatus(404);

    return;
  }

  res.set('Cache-Control', 'no-cache');
  res.type('png').send(panel.renderPng());
});

router.get('/:panelId.json', (req, res) => {
  const panel = getPanel(req.params.panelId);

  if (!panel) {
    res.sendStatus(404);

    return;
  }

  res.set('Cache-Control', 'no-cache');
  res.json(panel.renderJson());
});

export default router;
