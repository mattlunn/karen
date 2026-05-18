import express from 'express';
import auth from '../middleware/auth';
import { smarthomeHandlers, AlexaRequestWithEndpoint } from '../services/alexa/smarthome';
import { intentHandlers } from '../services/alexa/skill';
import { AlexaSmartHomeRequest } from '../services/alexa/smarthome/types';
import { AlexaSkillRequestBody } from '../services/alexa/skill/types';

const router = express.Router();

router.post('/smarthome', auth, async (req, res) => {
  const request = req.body.directive as AlexaSmartHomeRequest;
  const { namespace, messageId } = request.header;
  const handler = smarthomeHandlers[namespace];

  if (!handler) {
    res.status(404).json({ error: `No handler for namespace ${namespace}` });
    return;
  }

  try {
    const response = await handler(request);
    res.json(response);
  } catch (e) {
    res.json({
      event: {
        header: {
          namespace: 'Alexa',
          name: 'ErrorResponse',
          messageId,
          payloadVersion: 3
        },
        endpoint: (request as AlexaRequestWithEndpoint).endpoint,
        payload: {
          type: 'INTERNAL_ERROR',
          message: (e as Error).message
        }
      }
    });
  }
});

router.post('/skill', auth, async (req, res) => {
  const body = req.body as AlexaSkillRequestBody;
  const handler = intentHandlers[body.request.intent.name];

  if (!handler) {
    res.status(404).send('No handler setup to handle ' + body.request.intent.name);
    return;
  }

  const response = await handler(body.request.intent);
  res.status(200).json({ version: '1.0', response });
});

export default router;
