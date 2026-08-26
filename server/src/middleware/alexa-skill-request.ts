import { RequestHandler } from 'express';
import logger from '../logger';

// Nothing about the body is trustworthy until it has been checked, so it is read as if every part of
// it might be missing rather than as an AlexaSkillRequestBody.
interface UnverifiedBody {
  context?: { System?: { application?: { applicationId?: string } } };
}

/**
 * Alexa sends a custom skill no Authorization header and no cookies — an account-linking token, if
 * there is one, arrives in the body — so middleware/auth rejects every genuine request. The skill's
 * applicationId is the shared secret for this endpoint instead.
 *
 * The expected applicationId is passed in rather than read from config here, so that this can be
 * tested without config/app.json, which is not checked in and so does not exist in CI.
 */
export default function alexaSkillRequest(expectedApplicationId: string): RequestHandler {
  return (req, res, next) => {
    const body = req.body as UnverifiedBody | undefined;

    // Neither applicationId goes in the log line. Ours is not rotatable, so there is no reason to
    // copy it into the logs of whatever ships them off the box; and echoing a caller's guess back
    // alongside "wrong" is a slow way to leak which guesses were close.
    if (body?.context?.System?.application?.applicationId !== expectedApplicationId) {
      logger.warn('Rejecting an Alexa skill request sent for another skill');
      res.status(401).end();

      return;
    }

    next();
  };
}
