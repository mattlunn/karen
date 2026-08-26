import { RequestHandler } from 'express';
import config from '../config/app';
import logger from '../logger';
import { verifyAlexaSkillRequest, AlexaVerificationError } from '../services/alexa/skill/verify-request';

// Nothing about the body is trustworthy until it has been verified, so it is read as if every part
// of it might be missing rather than as an AlexaSkillRequestBody.
interface UnverifiedBody {
  context?: { System?: { application?: { applicationId?: string } } };
  request?: { timestamp?: string };
}

/**
 * Replaces middleware/auth for the custom skill endpoint. Alexa sends no bearer token and no
 * cookies, so auth would reject every genuine request; see services/alexa/skill/verify-request.
 */
const alexaSkillRequest: RequestHandler = async (req, res, next) => {
  const body = req.body as UnverifiedBody | undefined;

  try {
    await verifyAlexaSkillRequest({
      certChainUrl: req.header('SignatureCertChainUrl'),
      signature: req.header('Signature-256'),
      rawBody: req.rawBody,
      applicationId: body?.context?.System?.application?.applicationId,
      timestamp: body?.request?.timestamp,
      expectedApplicationId: config.alexa.id
    });
  } catch (e) {
    if (e instanceof AlexaVerificationError) {
      logger.warn({ err: e }, 'Rejecting an unverified Alexa skill request');
      res.status(401).end();

      return;
    }

    next(e);

    return;
  }

  next();
};

export default alexaSkillRequest;
