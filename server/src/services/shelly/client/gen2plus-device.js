import { createHash, randomBytes } from 'crypto';

// Gen2+ devices only accept this username.
const USERNAME = 'admin';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const BTHOME_OBJECT_ID_TO_PROPERTY = {
  1: 'battery',
  45: 'contact',
};

export default class Gen2PlusDeviceClient {
  constructor(ip, password, generation) {
    this._ip = ip;
    this._password = password;
    this._generation = generation;
  }

  async _request(path) {
    const url = new URL(`http://${this._ip}${path}`);
    let res = await fetch(url);

    if (res.status === 401) {
      res = await fetch(url, {
        headers: {
          Authorization: this._createDigestAuthorization(res.headers.get('WWW-Authenticate'), url.pathname + url.search)
        }
      });
    }

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

  _createDigestAuthorization(challenge, uri) {
    const { realm, nonce } = Object.fromEntries(
      [...challenge.matchAll(/(\w+)="?([^",]*)"?/g)].map(([, key, value]) => [key, value])
    );

    const cnonce = randomBytes(8).toString('hex');
    const nc = '00000001';
    const ha1 = sha256(`${USERNAME}:${realm}:${this._password}`);
    const ha2 = sha256(`GET:${uri}`);
    const response = sha256(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`);

    return `Digest username="${USERNAME}", realm="${realm}", nonce="${nonce}", uri="${uri}", cnonce="${cnonce}", nc=${nc}, qop=auth, response="${response}", algorithm=SHA-256`;
  }

  async setCloudStatus(enabled) {
    return await this._request(`/rpc/Cloud.SetConfig?config={"enable":${enabled ? 'true' : ' false'}}`);
  }

  async reboot() {
    return await this._request('/rpc/Shelly.Reboot');
  }

  async setupAuthentication() {
    const realm = await this.getMqttId();
    const ha1 = sha256(`${USERNAME}:${realm}:${this._password}`);

    return await this._request(`/rpc/Shelly.SetAuth?user="${USERNAME}"&realm="${realm}"&ha1="${ha1}"`);
  }

  async enableMqtt({ url, user, password, id }) {
    const config = {
      enable: true,
      server: url,
      user,
      pass: password,
      topic_prefix: `shellies/${id}`,
      status_ntf: true
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

  // Returns this Presence sensor's configured zones straight off the device, so callers don't
  // have to ask a human to know/type the zone ids and names set up in the Shelly app.
  async getPresenceZones() {
    const { components } = await this._request('/rpc/Shelly.GetComponents');

    return components
      .filter((component) => component.key.startsWith('presencezone:'))
      .map((component) => ({ id: `zone${component.config.id}`, name: component.config.name }));
  }

  async getEnergyMeterChannels() {
    const { components } = await this._request('/rpc/Shelly.GetComponents');

    return components
      .filter((component) => component.key.startsWith('em1:'))
      .map((component) => ({ id: `channel${component.config.id}`, name: component.config.name }));
  }

  // Returns the `{ [localSensorId]: property }` mapping for a BTHome (BLU) device
  // already paired to this gateway, restricted to object types Karen understands.
  async getBTHomeSensorsFor(mac) {
    const { components } = await this._request('/rpc/Shelly.GetComponents?dynamic_only=true');
    const sensors = {};

    for (const component of components) {
      if (!component.key.startsWith('bthomesensor:') || component.config.addr !== mac) {
        continue;
      }

      const property = BTHOME_OBJECT_ID_TO_PROPERTY[component.config.obj_id];

      if (property) {
        const id = component.key.split(':')[1];

        sensors[id] = property;
      }
    }

    return sensors;
  }
}
