import fetch from 'node-fetch';

export default class LightwaveRfClient {
  constructor(bearer, refreshToken) {
    this._bearer = bearer;
    this._refreshToken = refreshToken;
  }

  async authenticate() {
    const response = await fetch('https://auth.lightwaverf.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `basic ${this._bearer}`
      },
      body: JSON.stringify({
        'grant_type': 'refresh_token',
        'refresh_token': this._refreshToken
      })
    });

    if (response.ok) {
      const auth = await response.json();

      this._accessToken = auth.access_token;
      this._refreshToken = auth.refresh_token;

      return {
        accessToken: this._accessToken,
        refreshToken: this._refreshToken,
        expiresIn: auth.expires_in
      };
    } else {
      const error = await response.text();

      throw new Error(`${response.status}: ${error}`);
    }
  }

  async request(url, body, method) {
    const response = await fetch(`https://publicapi.lightwaverf.com/v1/${url.startsWith('/') ? url.slice(1) : url}`, {
      method: method || (body ? 'POST' : 'GET'),
      body: body && JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this._accessToken}`
      }
    });

    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(response.status);
    }
  }

  structures() {
    return this.request('/structures');
  }

  structure(id) {
    return this.request(`/structure/${id}`);
  }

  read(features) {
    const featuresArray = Array.isArray(features) ? features : [features];

    return this.request(`/features/read`, {
      features: featuresArray.map(featureId => ({ featureId }))
    });
  }

  write(features, value) {
    const featuresArray = Array.isArray(features) ? features : [{
      featureId: features,
      value
    }];

    return this.request(`/features/write`, {
      features: featuresArray
    });
  }
}