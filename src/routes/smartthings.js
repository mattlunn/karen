import express from 'express';
import fetch from 'node-fetch';
import asyncWrapper from '../helpers/express-async-wrapper';
import * as handlers from '../services/smartthings/handlers';
import { parseRequest, verifySignature } from 'http-signature';
import { parseCertificate } from 'sshpk';

const router = express.Router();
const certificateCache = new Map();

async function getOrFetchCertificateSubjectKey(url) {
  if (!certificateCache.has(url)) {
    const response = await fetch(url);

    certificateCache.set(url, parseCertificate(await response.buffer(), 'pem').subjectKey);
  }

  return certificateCache.get(url);
}

async function validateRequest(req) {
  // work around https://github.com/joyent/node-http-signature/issues/87
  const _url = req.url;
  req.url = req.originalUrl;

  const parsedRequest = parseRequest(req);

  req.url = _url;

  return verifySignature(parsedRequest, await getOrFetchCertificateSubjectKey(`https://key.smartthings.com${parsedRequest.keyId}`));
}

router.post('/endpoint', asyncWrapper(async (req, res, next) => {
  if (req.body.lifecycle !== 'PING' && !await validateRequest(req)) {
    console.warn('Request to /smartthings/endpoint was blocked, because the request was deemed invalid');
    return res.sendStatus(401);
  } else {
    next();
  }
}), asyncWrapper(async (req, res) => {
  const lifecycle = req.body.lifecycle.toLowerCase();

  if (handlers.hasOwnProperty(lifecycle)) {
    res.json(await Promise.resolve(handlers[lifecycle](req.body)));
  } else {
    res.sendStatus(400);
  }
}));

export default router;