import express from 'express';
import newrelic from 'newrelic';
import config from '../config/app';
import auth from '../middleware/auth';
import logger from '../logger';
import { smarthomeHandlers, AlexaRequestWithEndpoint, AlexaInvalidValueError } from '../services/alexa/smarthome';
import { intentHandlers } from '../services/alexa/skill';
import { AlexaSmartHomeRequest } from '../services/alexa/smarthome/types';
import { AlexaSkillRequestBody } from '../services/alexa/skill/types';

const router = express.Router();

router.post('/smarthome', auth, async (req, res) => {
  const request = req.body.directive as AlexaSmartHomeRequest;
  const { namespace, name: actionName, messageId } = request.header;
  const endpointId = (request as AlexaRequestWithEndpoint).endpoint?.endpointId;
  const handler = smarthomeHandlers[namespace];

  newrelic.addCustomAttributes({
    'alexa.namespace': namespace,
    'alexa.action': actionName,
    ...(endpointId !== undefined && { 'alexa.endpointId': endpointId }),
  });

  if (!handler) {
    res.status(404).json({ error: `No handler for namespace ${namespace}` });
    return;
  }

  try {
    const response = await handler(request);
    res.json(response);
  } catch (e) {
    logger.warn({ err: e, namespace, action: actionName }, 'Alexa smarthome directive failed');
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
          type: e instanceof AlexaInvalidValueError ? 'INVALID_VALUE' : 'INTERNAL_ERROR',
          message: (e as Error).message
        }
      }
    });
  }
});

router.post('/skill', async (req, res) => {
  const body = req.body as AlexaSkillRequestBody;

  if (body.context?.System?.application?.applicationId !== config.alexa.id) {
    res.status(401).end();
    return;
  }

  const intent = body.request.intent;

  newrelic.addCustomAttributes({
    'alexa.requestType': body.request.type,
    ...(intent !== undefined && { 'alexa.intent': intent.name }),
  });

  // Alexa sends LaunchRequest and SessionEndedRequest to any skill, neither of which carries an intent.
  if (intent === undefined) {
    res.status(200).json({ version: '1.0', response: { shouldEndSession: true } });
    return;
  }

  const handler = intentHandlers[intent.name];

  if (!handler) {
    res.status(404).send('No handler setup to handle ' + intent.name);
    return;
  }

  const response = await handler(intent);
  res.status(200).json({ version: '1.0', response });
});

export default router;
