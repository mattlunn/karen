import { UnifiClient } from '.';

function respond(status: number, body: string) {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status }));
}

describe('UnifiClient.getClientDevices', () => {
  const client = new UnifiClient('unifi', 443, 'user', 'pass');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the clients from an ok response', async () => {
    respond(200, JSON.stringify({ meta: { rc: 'ok' }, data: [{ name: 'Phone' }] }));

    await expect(client.getClientDevices()).resolves.toEqual([{ name: 'Phone' }]);
  });

  it('returns an empty list when the controller reports no clients', async () => {
    respond(200, JSON.stringify({ meta: { rc: 'ok' }, data: [] }));

    await expect(client.getClientDevices()).resolves.toEqual([]);
  });

  it('throws on a non-2xx response with a JSON body', async () => {
    respond(502, JSON.stringify({ error: { code: 502, message: 'Bad Gateway' } }));

    await expect(client.getClientDevices()).rejects.toThrow('returned HTTP 502');
  });

  it('throws on an ok response with no data', async () => {
    respond(200, JSON.stringify({ error: { code: 403, message: 'Forbidden' } }));

    await expect(client.getClientDevices()).rejects.toThrow('unexpected body');
  });

  it('throws when the controller reports an error', async () => {
    respond(200, JSON.stringify({ meta: { rc: 'error', msg: 'api.err.NoSiteContext' } }));

    await expect(client.getClientDevices()).rejects.toThrow('api.err.NoSiteContext');
  });
});
