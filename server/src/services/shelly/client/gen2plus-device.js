import fetch from 'node-fetch';

export default class Gen2PlusDeviceClient {
  constructor(ip, username, password, generation) {
    this._ip = ip;
    this._username = username;
    this._password = password;
    this._generation = generation;
  }

  async _request(path) {
    const res = await fetch(`http://${this._ip}${path}`);
    const body = await res.text();

    if (!res.ok) {
      throw new Error(body);
    }

    if (body === '') {
      return Promise.resolve();
    } else { 
      return JSON.parse(body);
    }
  }

  async setCloudStatus(enabled) {
    return await this._request(`/rpc/Cloud.SetConfig?config={"enable":${enabled ? 'true' : ' false'}}`);
  }

  async reboot() {
    return await this._request('/rpc/Shelly.Reboot');
  }

  async setupAuthentication() {
    /*
    const deviceId = (await this._request('/rpc/Shelly.GetDeviceInfo')).id;
    const hash = createHash('sha256').update(`${this._username}:${this.deviceId}:${this._password}`).digest('hex');

    return await this._request(`/rpc/Shelly.SetAuth?user="${this._username}"&realm="${deviceId}"&ha1="${hash}"`);
    */

    return Promise.resolve();
  }

  async setIsOn(isOn) {
    return await this._request(`/rpc/Switch.Set?id=0&on=${isOn ? 'true' : 'false'}`);
  }

  async setOutputOnWebhook(endpoint) {
    return await this._request(`/rpc/Webhook.Create?cid=0&enable=true&event="switch.on"&urls=["${encodeURIComponent(endpoint)}"]`);
  }

  async setOutputOffWebhook(endpoint) {
    return await this._request(`/rpc/Webhook.Create?cid=0&enable=true&event="switch.off"&urls=["${encodeURIComponent(endpoint)}"]`);
  }

  async setBrightness() {
    throw new Error();
  }

  async getDeviceName() {
    return (await this._request(`/rpc/Sys.GetConfig`)).device.name;
  }

  getGeneration() {
    return this._generation;
  }

  async getModel() {
    return (await this._request('/shelly')).model;
  }

  async setLedMode(mode) {
    return await this._request(`/rpc/PLUGUK_UI.SetConfig?config={"leds":{"mode":"${mode}"}}`);
  }
}