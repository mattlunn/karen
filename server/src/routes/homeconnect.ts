import express from 'express';
import config from '../config';
import { exchangeAuthorizationCode } from '../services/homeconnect/lib/auth';

const router = express.Router();

router.use((req, res, next) => {
  if (req.query.secret !== config.homeconnect.secret) {
    return res.sendStatus(401).end();
  } else {
    next();
  }
});

router.get('/authorize', async (req, res) => {
  if (typeof req.query.code === 'string') {
    await exchangeAuthorizationCode(req.query.code);

    res.send('Home Connect authorised. You can close this tab.');
  } else {
    res.redirect(`https://api.home-connect.com/security/oauth/authorize?response_type=code&client_id=${config.homeconnect.client_id}`);
  }
});

export default router;
