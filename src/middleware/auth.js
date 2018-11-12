import asyncWrapper from '../helpers/express-async-wrapper';
import { Token } from '../models';

const factories = [
  function (req, res) {
    const token = (
      req.header('Authorization') || ''
    ).match(/^Bearer ([a-zA-Z0-9_=\/+]{1,255})$/);

    return token === null ? null : token[1];
  },

  function (req, res) {
    return req.cookies['OAuth.AccessToken'];
  }
];

export default asyncWrapper(async (req, res, next) => {
  for (const factory of factories) {
    const token = factory(req, res);

    try {
      if (token && await Token.isValid(token)) {
        return next();
      }
    } catch (e) {}
  }

  res
    .status(401)
    .end();
})