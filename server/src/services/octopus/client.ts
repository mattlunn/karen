import config from '../../config';

export interface TelemetryReading {
  readAt: Date;
  demandWatts: number;
}

export interface RateInterval {
  start: Date;
  end: Date | null; // null while the rate is the current open-ended one
  value: number; // pence (inc. VAT)
}

interface AccountResponse {
  properties: {
    electricity_meter_points: {
      mpan: string;
      meters: { serial_number: string }[];
      agreements: { tariff_code: string }[];
    }[];
  }[];
}

interface RateResult {
  value_inc_vat: number;
  valid_from: string;
  valid_to: string | null;
}

const BASE_URL = 'https://api.octopus.energy';
const GRAPHQL_URL = 'https://api.octopus.energy/v1/graphql/';

function authHeader(): string {
  return `Basic ${Buffer.from(`${config.octopus.api_key}:`).toString('base64')}`;
}

// Kraken (GraphQL) tokens are short-lived (~1h). Cache and refresh ahead of expiry
// rather than re-authenticating on every telemetry poll.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function graphqlRequest<T>(query: string, variables: Record<string, unknown>, authToken?: string): Promise<T> {
  let response;

  try {
    response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: authToken })
      },
      body: JSON.stringify({ query, variables })
    });
  } catch (e: any) {
    throw new Error(`Octopus GraphQL request failed: ${e.message}`);
  }

  if (!response.ok) {
    throw new Error(`Octopus GraphQL request failed with HTTP status ${response.status}: ${await response.text()}`);
  }

  const body = await response.json() as { data: T; errors?: { message: string }[] };

  if (body.errors) {
    throw new Error(`Octopus GraphQL request failed: ${body.errors.map(e => e.message).join(', ')}`);
  }

  return body.data;
}

async function getGraphQLToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60 * 1000) {
    return cachedToken.token;
  }

  const data = await graphqlRequest<{ obtainKrakenToken: { token: string } }>(
    `mutation krakenTokenAuthentication($apiKey: String!) {
      obtainKrakenToken(input: { APIKey: $apiKey }) { token }
    }`,
    { apiKey: config.octopus.api_key }
  );

  const token = data.obtainKrakenToken.token;
  const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));

  cachedToken = { token, expiresAt: exp * 1000 };

  return token;
}

// The telemetry device ID never changes for a given account, and doesn't fit
// in devices.metaStringified (varchar(255)) alongside the existing tariff
// meta, so it's cached in-memory for the life of the process instead.
let cachedTelemetryDeviceId: string | null = null;

export async function getSmartMeterDeviceId(accountNumber: string): Promise<string> {
  if (cachedTelemetryDeviceId) {
    return cachedTelemetryDeviceId;
  }

  const token = await getGraphQLToken();
  const data = await graphqlRequest<{
    account: { electricityAgreements: { meterPoint: { meters: { smartDevices: { deviceId: string; status: string }[] }[] } }[] };
  }>(
    `query getSmartDevices($accountNumber: String!) {
      account(accountNumber: $accountNumber) {
        electricityAgreements(active: true) {
          meterPoint { meters { smartDevices { deviceId status } } }
        }
      }
    }`,
    { accountNumber },
    token
  );

  const smartDevices = data.account.electricityAgreements
    .flatMap(a => a.meterPoint.meters)
    .flatMap(m => m.smartDevices);

  const device = smartDevices.find(d => d.status === 'COMMISSIONED') ?? smartDevices[0];

  if (!device) {
    throw new Error(`No smart meter telemetry device found for Octopus account ${accountNumber}`);
  }

  cachedTelemetryDeviceId = device.deviceId;

  return cachedTelemetryDeviceId;
}

export async function getTelemetry(deviceId: string, since: Date, until: Date): Promise<TelemetryReading[]> {
  const token = await getGraphQLToken();
  const data = await graphqlRequest<{
    smartMeterTelemetry: { readAt: string; demand: string }[];
  }>(
    `query getTelemetry($deviceId: String!, $start: DateTime!, $end: DateTime!, $grouping: TelemetryGrouping!) {
      smartMeterTelemetry(deviceId: $deviceId, start: $start, end: $end, grouping: $grouping) {
        readAt
        demand
      }
    }`,
    { deviceId, start: since.toISOString(), end: until.toISOString(), grouping: 'ONE_MINUTE' },
    token
  );

  return data.smartMeterTelemetry.map(r => ({
    readAt: new Date(r.readAt),
    demandWatts: Math.round(Number(r.demand))
  }));
}

async function request<T>(url: string): Promise<T> {
  let response;

  try {
    response = await fetch(url, {
      headers: {
        Authorization: authHeader()
      }
    });
  } catch (e: any) {
    throw new Error(`Octopus request to ${url} failed: ${e.message}`);
  }

  if (!response.ok) {
    throw new Error(`Octopus request to ${url} failed with HTTP status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Octopus list endpoints are paginated via an absolute `next` URL.
async function requestAllPages<T>(url: string): Promise<T[]> {
  const results: T[] = [];
  let next: string | null = url;

  while (next !== null) {
    const page: { results: T[]; next: string | null } = await request(next);
    results.push(...page.results);
    next = page.next;
  }

  return results;
}

// The product code is embedded in the tariff code: a tariff like
// `E-1R-AGILE-FLEX-22-11-25-C` belongs to product `AGILE-FLEX-22-11-25`
// (strip the `E-1R-` prefix and the trailing `-<GSP>` region letter).
function productCodeFromTariff(tariffCode: string): string {
  return tariffCode.replace(/^E-1R-/, '').replace(/-[A-Z]$/, '');
}

export async function getTariff(): Promise<{ tariffCode: string; productCode: string }> {
  const account = await request<AccountResponse>(
    `${BASE_URL}/v1/accounts/${config.octopus.account_number}/`
  );

  const meterPoint = account.properties[0].electricity_meter_points[0];
  const agreement = meterPoint.agreements[meterPoint.agreements.length - 1];
  const tariffCode = agreement.tariff_code;

  return { tariffCode, productCode: productCodeFromTariff(tariffCode) };
}

export async function getUnitRates(tariffCode: string, productCode: string, since: Date, until: Date): Promise<RateInterval[]> {
  const url = `${BASE_URL}/v1/products/${productCode}/electricity-tariffs/${tariffCode}`
    + `/standard-unit-rates/?period_from=${since.toISOString()}&period_to=${until.toISOString()}&page_size=25000`;

  return mapRates(await requestAllPages<RateResult>(url));
}

export async function getStandingCharges(tariffCode: string, productCode: string, since: Date, until: Date): Promise<RateInterval[]> {
  const url = `${BASE_URL}/v1/products/${productCode}/electricity-tariffs/${tariffCode}`
    + `/standing-charges/?period_from=${since.toISOString()}&period_to=${until.toISOString()}&page_size=25000`;

  return mapRates(await requestAllPages<RateResult>(url));
}

function mapRates(results: RateResult[]): RateInterval[] {
  return results
    .map(r => ({
      start: new Date(r.valid_from),
      end: r.valid_to ? new Date(r.valid_to) : null,
      value: r.value_inc_vat
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
