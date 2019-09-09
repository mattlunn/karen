import fetch from 'node-fetch';
import config from '../../config.json';
import { stringify } from 'querystring';
import { saveConfig } from '../../helpers/config';

let token;

export async function getAccessToken() {
  if (!token || token.expiresAt < Date.now() + 1000 * 60) {
    const response = await fetch('https://auth.tado.com/oauth/token', {
      method: 'POST',
      body: stringify({
        client_id: 'tado-web-app',
        client_secret: 'wZaRN7rpjn3FoNyF5IFuxg9uMzYJcvOoQ8QWiIqS3hfk6gLhVlG57j5YNoZL2Rtc',
        grant_type: 'refresh_token',
        refresh_token: config.tado.refresh_token,
        scope: 'home.user'
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      throw new Error(`Unable to get Access Token: HTTP status code was '${response.status}'`);
    }

    const { access_token, refresh_token, expires_in } = await response.json();

    if (process.env.NODE_ENV === 'development') {
      console.log(`Rotating Tado refresh_token from ${config.tado.refresh_token} to ${refresh_token}`);
      console.log(`Tado access_token is '${access_token}'`);
    }

    config.tado.refresh_token = refresh_token;
    saveConfig();

    token = {
      accessToken: access_token,
      expiresAt: Date.now() + (expires_in * 1000)
    };
  }

  return token.accessToken;
}

export default class TadoClient {
  constructor(accessToken, homeId) {
    this.accessToken = accessToken;
    this.homeId = homeId;
  }

  async _request(url, body, verb) {
    const response = await fetch(`https://my.tado.com/api/v2/homes/${this.homeId}${url}`, {
      method: verb || (body ? 'PUT' : 'GET'),
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 204) {
      return Promise.resolve();
    }

    const json = await response.json();

    if (json.errors && json.errors.length) {
      throw new Error(`${json.errors[0].code}: ${json.errors[0].title}`);
    }

    return json;
  }

  async getZones() {
    return this._request('/zones');
  }

  async getZoneState(zone) {
    return this._request(`/zones/${zone}/state`);
  }

  async setHeatingPowerForZone(zone, value) {
    return this._request(`/zones/${zone}/overlay`, {
      setting: {
        type: 'HEATING',
        power: value === false ? 'OFF' : 'ON',
        temperature: value === false ? null : {
          celsius: value
        }
      },
      termination: {
        type: 'MANUAL'
      }
    });
  }

  async endManualHeatingForZone(zone) {
    return this._request(`/zones/${zone}/overlay`, null, 'DELETE');
  }
}