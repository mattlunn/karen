import { stringify } from 'querystring';
import fetch from 'node-fetch';

export default class DeviceClient {
  constructor(ip, username, password) {
    this._ip = ip;
    this._username = username;
    this._password = password;
  }

  async _request(path, args = {}) {
    // Endpoint to define actions (webhooks) requires the "urls[]" query string parameter
    // to literally be "urls[]", not "urls%5B%5D". By default, stringify encodes the [].
    const res = await fetch(`http://${this._ip}${path}?${stringify(args, '&', '=', {
      encodeURIComponent: String
    })}`, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${this._username}:${this._password}`).toString('base64')
      }
    });

    const body = await res.text();

    if (!res.ok) {
      throw new Error(body);
    }

    return JSON.parse(body);
  }

  async setCloudStatus(enabled) {
    return await this._request('/settings/cloud', { 
      enabled: enabled ? '1' : '0'
    });
  }

  async reboot() {
    const res = await this._request('/reboot');

    if (!res.ok) {
      throw new Error('Restart was not successful');
    }
  }

  async setIsOn(isOn) {
    return await this._request('/light/0', {
      turn: isOn ? 'on' : 'off'
    });
  }

  async setBrightness(brightness) {
    return await this._request('/light/0', {
      brightness
    });
  }

  async setupAuthentication() {
    return await this._request('/settings/login', { 
      username: this._username,
      password: this._password,
      enabled: '1'
    });
  }

  async getBasic() {
    return await this._request('/shelly');
  }

  async addAction(name, endpoint) {
    return await this._request('/settings/actions/', {
      index: 0,
      enabled: true,
      name,
      'urls[]': encodeURIComponent(endpoint)
    });
  }

  async getDeviceName() {
    return (await this._request('/settings')).name;
  }
}