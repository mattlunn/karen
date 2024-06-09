import request from 'request-promise-native';

function Synology(host, port, account, password, session) {
  this._host = host;
  this._port = port;
  this._account = account;
  this._password = password;
  this._session = session || 'SurveillanceStation';
  this._sid = undefined;
}

Synology.prototype.init = async function () {
  const data = await this._request('query.cgi', 'SYNO.API.Info', 'Query', 1, { query: 'ALL' }, true);

  this._apis = data.data;

  const auth = await this.request('SYNO.API.Auth', 'login', {
    account: this._account,
    passwd: this._password,
    session: this._session,
    format: 'sid'
  }, true);

  this._sid = auth.data.sid;
};

Synology.prototype.request = function (api, method, params = {}, json = true, version = undefined) {
  if (!this._apis.hasOwnProperty(api)) {
    throw new Error('Synology does not have an API for ' + api);
  }

  if (typeof version === 'undefined') {
    version = this._apis[api].maxVersion;
  }

  return this._request(this._apis[api].path, api, method, version, params, json);
};

Synology.prototype._request = async function (endpoint, api, method, version, params, json) {
  params.version = version;
  params.method = method;
  params.api = api;

  if (typeof this._sid !== 'undefined')
    params._sid = this._sid;

  const query = Object.keys(params).map((key) => key + '=' + encodeURIComponent(params[key])).join('&');
  const url = 'http://' + this._host + ':' + this._port + '/webapi/' + endpoint + '?' + query;
  const response = await request(url, {
    encoding: (json ? 'utf8' : null)
  });

  if (!json) {
    return response;
  }

  const parsed = JSON.parse(response);

  if (!parsed.success) {
    const error = new Error(parsed.error.code);

    error.code = parsed.error.code;
    throw error;
  }

  return parsed;
};

export default async function (host, port, account, password, session) {
  const synology = new Synology(host, port, account, password, session);
  await synology.init();

  return synology;
}