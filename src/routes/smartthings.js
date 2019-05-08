import express from 'express';
import config from '../config';
import { saveConfig } from '../helpers/config';
import asyncWrapper from "../helpers/express-async-wrapper";

const router = express.Router();

router.post('/endpoint', asyncWrapper(async (req, res) => {
  switch (req.body.lifecycle) {
    case 'PING':
      res.json({
        pingData: req.body.pingData
      });
      break;
    case 'CONFIGURATION':
      if (req.body.configurationData.phase === 'INITIALIZE') {
        res.json({
          configurationData: {
            initialize: {
              name: 'Karen',
              description: 'I care',
              id: 'app',
              permissions: ['r:devices:*', 'w:devices:*', 'x:devices:*', 'i:deviceprofiles', 'r:locations:*'],
              firstPageId: '1'
            }
          }
        });
      } else {
        res.json({
          configurationData: {
            page: {
              pageId: '1',
              name: 'Setup',
              complete: true,
              nextPageId: null,
              previousPageId: null,
              sections: []
            }
          }
        });
      }

      break;
    case 'INSTALL':
      config.smartthings.refresh_token = req.body.installData.refreshToken;
      saveConfig();
      break;
  }

  console.dir(req.body, { depth: null });
}));

export default router;