import fetch from 'node-fetch';

export default class SmartThingsClient {
  constructor(token) {
    this._token = token;
  }

  async _request(url, body) {
    const response = await fetch(`https://api.smartthings.com/v1/${url.startsWith('/') ? url.slice(1) : url}`, {
      headers: {
        'Authorization': `Bearer ${this._token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: body ? 'POST' : 'GET',
      body: body ? JSON.stringify(body) : undefined
    });

    const json = await response.json();

    if (response.ok) {
      return json;
    } else {
      const error = new Error(json.error.message);

      error.status = response.status;
      error.code = json.error.code;
      error.details = json.error.details;

      console.dir(json, { depth: null });

      throw error;
    }
  }

  getDevices() {
    return this._request('/devices');
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