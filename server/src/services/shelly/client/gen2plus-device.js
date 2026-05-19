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
    return Promise.resolve();
  }

  async enableMqtt({ url, user, password }) {
    const config = {
      enable: true,
      server: url,
      user,
      pass: password,
      topic_prefix: 'shellies'
    };

    return await this._request(`/rpc/Mqtt.SetConfig?config=${encodeURIComponent(JSON.stringify(config))}`);
  }

  async getMqttId() {
    return (await this._request('/rpc/Shelly.GetDeviceInfo')).id;
  }

  async getSwitchConfig() {
    return await this._request('/rpc/Switch.GetConfig?id=0');
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
