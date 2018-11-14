import asyncWrapper from '../helpers/express-async-wrapper';
import { Token } from '../models';

const factories = [
  function (req) {
    const token = (
      req.header('Authorization') || ''
    ).match(/^Bearer ([a-zA-Z0-9_=\/+]{1,255})$/);

    return token === null ? null : token[1];
  },

  function (req) {
    return req.cookies['OAuth.AccessToken'];
  }
];

export default asyncWrapper(async (req, res, next) => {
  req.token = null;

  for (const factory of factories) {
    const token = factory(req);

    try {
      if (token && await Token.isValid(token)) {
        req.token = token;

        return next();
      }
    } catch (e) {}
  }

  res
    .status(401)
    .end();
})