import { Router } from 'express';
import { getPanel } from '../services/eink/registry';

const router = Router();

router.get('/:panelId.png', (req, res) => {
  const panel = getPanel(req.params.panelId);

  if (!panel) {
    res.sendStatus(404);

    return;
  }

  const png = panel.renderPng();

  if (!png) {
    res.sendStatus(503);

    return;
  }

  res.set('Cache-Control', 'no-cache');
  res.type('png').send(png);
});

router.get('/:panelId.json', (req, res) => {
  const panel = getPanel(req.params.panelId);

  if (!panel) {
    res.sendStatus(404);

    return;
  }

  const json = panel.renderJson();

  if (!json) {
    res.sendStatus(503);

    return;
  }

  res.set('Cache-Control', 'no-cache');
  res.json(json);
});

export default router;
