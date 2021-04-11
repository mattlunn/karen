import config from '../../config';
import fetch from 'node-fetch';
import { stringify } from 'querystring';
import { saveConfig } from '../../helpers/config';
import uuid from 'uuid/v4';

export async function exchangeAuthenticationToken(grantType, exchangeToken) {
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
    console.log(await response.text());

    throw new Error(`Received a ${response.status} while exchanging auth tokens`);
  } else {
    const json = await response.json();

    config.alexa.access_token = json.access_token;
    config.alexa.refresh_token = json.refresh_token;

    saveConfig();

    return {
      accessToken: json.access_token,
      expiresAt: new Date(Date.now() + (json.expires_in * 1000) - 5000)
    };
  }
}

let tokenDetails;

export async function getAccessToken() {
  if (!tokenDetails || Date.now() > tokenDetails?.expiresAt) {
    tokenDetails = await exchangeAuthenticationToken('refresh_token', config.alexa.refresh_token);
  }

  return tokenDetails.accessToken;
}

export async function sendChangeReport(deviceId, changedProperty, changeReason, otherProperties = []) {
  const response = await fetch('https://api.amazon.com/v3/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event: {
        header: {
          namespace: 'Alexa',
          name: 'ChangeReport',
          messageId: uuid(),
          payloadVersion: '3'
        },
        endpoint: {
          scope: {
            type: 'BearerToken',
            token: await getAccessToken()
          },
          endpointId: deviceId
        },
        payload: {
          change: {
            cause: {
              type: changeReason
            },
            properties: [changedProperty]
          }
        }
      },
      context: {
        properties: otherProperties
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Got a ${response.status} back, while trying to update property for ${deviceId}`);
  }
}