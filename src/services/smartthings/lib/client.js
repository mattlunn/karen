import fetch from 'node-fetch';

export default class SmartThingsClient {
  constructor(token) {
    this._token = token;
  }

  async _request(url, data) {
    const response = await fetch(`https://api.smartthings.com/v1/${url.startsWith('/') ? url.slice(1) : url}`, {
      headers: {
        'Authorization': `Bearer ${this._token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: data ? 'POST' : 'GET',
      body: data ? JSON.stringify(data) : undefined
    });

    const body = await response.text();

    if (response.ok) {
      return JSON.parse(body);
    } else {
      let error;

      try {
        const json = JSON.parse(body);

        error = new Error(json.error.message);
        error.code = json.error.code;
        error.details = json.error.details;
      } catch (e) {
        error = new Error(`Got HTTP ${response.status} from SmartThings API while requesting ${url}. Response was not valid JSON.`);
        error.code = -1;
        error.details = body;
      }

      error.status = response.status;
      console.dir(error, { depth: null });

      throw error;
    }
  }

  getDevices() {
    return this._request('/devices');
  }

  getDeviceStatus(id) {
    return this._request(`/devices/${id}/status`);
  }

  getInstalledApps() {
    return this._request('/installedapps');
  }

  getSubscriptions(installedAppId) {
    return this._request(`/installedapps/${installedAppId}/subscriptions`);
  }

  createSubscription(installedAppId, subscription) {
    return this._request(`/installedapps/${installedAppId}/subscriptions`, subscription);
  }

  issueCommand(deviceId, command) {
    return this._request(`/devices/${deviceId}/commands`, {
      commands: [command]
    });
  }
}