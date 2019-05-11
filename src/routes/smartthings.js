import express from 'express';
import config from '../config';
import { saveConfig } from '../helpers/config';
import asyncWrapper from "../helpers/express-async-wrapper";
import { setLightFeatureValue } from '../services/lightwaverf';
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

      res.json({
        installData: {}
      });
      break;
    case 'EVENT':
      for (const event of req.body.eventData.events) {
        const isOn = Number(event.deviceEvent.value === 'active');

        console.log('Switching light to ' + isOn);
        setLightFeatureValue('5a477b7772bed00a33c7198e-43-3157329939+0', isOn);
      }

      res.sendStatus(200);
      break;
    default:
      res.sendStatus(400);
      break;
  }

  console.dir(req.body, { depth: null });
}));

export default router;