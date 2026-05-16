import { RequestHandler } from 'express';
import { BUILD_VERSION } from '../helpers/build-version';

const buildVersion: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Build-Version', BUILD_VERSION);
  next();
};

export default buildVersion;
