import config from '../../config';

export interface ConsumptionInterval {
  start: Date;
  end: Date;
  consumption: number; // kWh
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

interface ConsumptionResult {
  consumption: number;
  interval_start: string;
  interval_end: string;
}

interface RateResult {
  value_inc_vat: number;
  valid_from: string;
  valid_to: string | null;
}

const BASE_URL = 'https://api.octopus.energy';

function authHeader(): string {
  return `Basic ${Buffer.from(`${config.octopus.api_key}:`).toString('base64')}`;
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

export async function getConsumption(since: Date, until: Date): Promise<ConsumptionInterval[]> {
  const url = `${BASE_URL}/v1/electricity-meter-points/${config.octopus.mpan}/meters/${config.octopus.serial_number}`
    + `/consumption/?period_from=${since.toISOString()}&period_to=${until.toISOString()}&page_size=25000&order_by=period`;

  const results = await requestAllPages<ConsumptionResult>(url);

  return results.map(r => ({
    start: new Date(r.interval_start),
    end: new Date(r.interval_end),
    consumption: r.consumption
  }));
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
