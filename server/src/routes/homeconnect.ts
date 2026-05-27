import express from 'express';
import config from '../config';
import { stringify} from 'querystring';
import logger from '../logger';
import { saveConfig } from '../helpers/config';

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
    const request = await fetch(`https://api.home-connect.com/security/oauth/token`, {
      body: stringify({
        client_id: config.homeconnect.client_id,
        client_secret: config.homeconnect.client_secret,
        grant_type: 'authorization_code',
        code: req.query.code
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      method: 'POST'
    });

    const token = await request.json() as { access_token: string; refresh_token: string; expires_in: number };

    if (!token.refresh_token) {
      logger.error({ token }, 'HomeConnect OAuth response missing refresh_token');
      return res.status(500).send('OAuth error: no refresh_token in response');
    }

    config.homeconnect.refresh_token = token.refresh_token;
    saveConfig();
    logger.info('HomeConnect authorized successfully');
    res.send('HomeConnect authorized. You can close this tab.');
  } else {
    res.redirect(`https://api.home-connect.com/security/oauth/authorize?response_type=code&client_id=${config.homeconnect.client_id}`);
  }
});

export default router;