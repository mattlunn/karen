import { stringify } from 'querystring';

export default class Gen1DeviceClient {
  constructor(ip, username, password) {
    this._ip = ip;
    this._username = username;
    this._password = password;
  }

  async _request(path, args = {}) {
    const res = await fetch(`http://${this._ip}${path}?${stringify(args)}`, {
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

  async setupAuthentication() {
    return await this._request('/settings/login', {
      username: this._username,
      password: this._password,
      enabled: '1'
    });
  }

  async enableMqtt({ url, user, password }) {
    return await this._request('/settings', {
      mqtt_enable: 'true',
      mqtt_server: url,
      mqtt_user: user,
      mqtt_pass: password,
      mqtt_retain: 'true',
    });
  }

  async getMqttId() {
    return (await this._request('/settings')).device.hostname;
  }

  async getDeviceName() {
    return (await this._request('/settings')).name;
  }

  getGeneration() {
    return 1;
  }

  async getModel() {
    return (await this._request('/shelly')).type;
  }
}
