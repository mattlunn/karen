import config from '../../config';
import logger from '../../logger';
import { stringify } from 'querystring';
import { saveConfig } from '../../helpers/config';
import { v4 as uuid } from 'uuid';

interface TokenDetails {
  accessToken: string;
  expiresAt: number;
}

export async function exchangeAuthenticationToken(grantType: 'refresh_token' | 'authorization_code', exchangeToken: string): Promise<TokenDetails> {
  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: stringify({
      grant_type: grantType,
      client_id: config.alexa.client_id,
      client_secret: config.alexa.client_secret,
      [grantType === 'refresh_token' ? 'refresh_token' : 'code']: exchangeToken
    })
  });

  if (!response.ok) {
    logger.error(await response.text());

    throw new Error(`Received a ${response.status} while exchanging auth tokens`);
  } else {
    const json = await response.json() as { access_token: string; refresh_token: string; expires_in: number };

    config.alexa.access_token = json.access_token;
    config.alexa.refresh_token = json.refresh_token;

    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Setting Alexa access token to '${json.access_token}' and refresh token to '${json.refresh_token}'`);
    }

    saveConfig();

    return {
      accessToken: json.access_token,
      expiresAt: Date.now() + (json.expires_in * 1000) - 5000
    };
  }
}

let tokenDetails: TokenDetails | undefined;

export async function getAccessToken(): Promise<string> {
  if (!tokenDetails || Date.now() > tokenDetails.expiresAt) {
    tokenDetails = await exchangeAuthenticationToken('refresh_token', config.alexa.refresh_token);
  }

  return tokenDetails.accessToken;
}

export async function sendAddOrUpdateReport(endpoints: unknown[]): Promise<void> {
  const bearer = await getAccessToken();
  const response = await fetch('https://api.eu.amazonalexa.com/v3/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bearer}`
    },
    body: JSON.stringify({
      event: {
        header: {
          namespace: 'Alexa.Discovery',
          name: 'AddOrUpdateReport',
          messageId: uuid(),
          payloadVersion: '3'
        },
        payload: {
          endpoints,
          scope: {
            type: 'BearerToken',
            token: bearer
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Got a ${response.status} back while sending Alexa.Discovery AddOrUpdateReport`);
  }
}

export async function sendSimpleEventSource(deviceId: number | string): Promise<void> {
  const endpointId = String(deviceId);
  const instanceId = `${endpointId}-1`;
  const bearer = await getAccessToken();
  const response = await fetch('https://api.eu.amazonalexa.com/v3/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bearer}`
    },
    body: JSON.stringify({
      event: {
        header: {
          namespace: 'Alexa.SimpleEventSource',
          name: 'Event',
          instance: instanceId,
          messageId: uuid(),
          payloadVersion: '1.0'
        },
        endpoint: {
          scope: {
            type: 'BearerToken',
            token: bearer
          },
          endpointId
        },
        payload: {
          id: 'Button.SinglePush.1',
          timestamp: new Date().toISOString()
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Got a ${response.status} back, while trying to send SimpleEvent for ${endpointId}`);
  }
}
