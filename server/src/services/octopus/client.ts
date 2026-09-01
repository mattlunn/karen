import config from '../../config/app';

export interface TelemetryReading {
  readAt: Date;
  demandWatts: number;
}

export interface RateInterval {
  start: Date;
  end: Date; // clamped to the fetch window; only `start` and `value` are persisted
  value: number; // pence (inc. VAT)
}

export interface TariffAgreement {
  tariffCode: string;
  productCode: string;
  validFrom: Date;
  validTo: Date | null; // null for the current, open-ended agreement
}

interface AccountResponse {
  properties: {
    electricity_meter_points: {
      mpan: string;
      meters: { serial_number: string }[];
      agreements: { tariff_code: string; valid_from: string; valid_to: string | null }[];
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

export async function getSmartMeterDeviceId(accountNumber: string): Promise<string> {
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

  const device = smartDevices.find(d => d.status === 'COMMISSIONED');

  if (!device) {
    throw new Error(`No smart meter telemetry device found for Octopus account ${accountNumber}`);
  }

  return device.deviceId;
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

export async function getAgreements(): Promise<TariffAgreement[]> {
  const account = await request<AccountResponse>(
    `${BASE_URL}/v1/accounts/${config.octopus.account_number}/`
  );

  const meterPoint = account.properties[0].electricity_meter_points[0];

  return meterPoint.agreements
    .map(a => ({
      tariffCode: a.tariff_code,
      productCode: productCodeFromTariff(a.tariff_code),
      validFrom: new Date(a.valid_from),
      validTo: a.valid_to ? new Date(a.valid_to) : null
    }))
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
}

export async function getUnitRates(agreements: TariffAgreement[], since: Date, until: Date): Promise<RateInterval[]> {
  return fetchAcrossAgreements(agreements, since, until, 'standard-unit-rates');
}

export async function getStandingCharges(agreements: TariffAgreement[], since: Date, until: Date): Promise<RateInterval[]> {
  return fetchAcrossAgreements(agreements, since, until, 'standing-charges');
}

// Octopus serves rates for any product regardless of which tariff the account
// was actually on, so a single `[since, until]` fetch against the current tariff
// silently rewrites history after a tariff switch. Fetch each agreement's own
// window from its own product instead, and clamp what comes back to that window:
// flat tariffs and standing charges return a single open-ended interval whose
// `valid_from` reaches back months, which we want to land as an event at the
// window boundary rather than discard as historic.
async function fetchAcrossAgreements(agreements: TariffAgreement[], since: Date, until: Date, path: string): Promise<RateInterval[]> {
  const relevant = agreements.filter(a =>
    a.validFrom.getTime() < until.getTime() && (a.validTo === null || a.validTo.getTime() > since.getTime())
  );
  const intervals: RateInterval[] = [];

  for (const agreement of relevant) {
    const windowStart = Math.max(since.getTime(), agreement.validFrom.getTime());
    const windowEnd = Math.min(until.getTime(), agreement.validTo?.getTime() ?? until.getTime());
    const url = `${BASE_URL}/v1/products/${agreement.productCode}/electricity-tariffs/${agreement.tariffCode}`
      + `/${path}/?period_from=${new Date(windowStart).toISOString()}&period_to=${new Date(windowEnd).toISOString()}&page_size=25000`;

    for (const r of await requestAllPages<RateResult>(url)) {
      // Clamp each slot to the agreement's window. The endpoint returns whole
      // slots either side of period_from/period_to, and a flat tariff returns a
      // single open-ended slot reaching back months - but a slot only counts for
      // the tariff in force during it, and a slot that collapses to nothing
      // belongs wholly to the adjacent agreement. This also keeps starts
      // strictly increasing across agreements for sync().
      const start = Math.max(new Date(r.valid_from).getTime(), windowStart);
      const end = Math.min(r.valid_to ? new Date(r.valid_to).getTime() : windowEnd, windowEnd);

      if (start >= end) {
        continue;
      }

      intervals.push({ start: new Date(start), end: new Date(end), value: r.value_inc_vat });
    }
  }

  return intervals.sort((a, b) => a.start.getTime() - b.start.getTime());
}
