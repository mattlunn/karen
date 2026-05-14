import config from '../../config';
import logger from '../../logger';

export interface ConsumptionInterval {
  start: Date;
  end: Date;
  consumption: number; // kWh
}

export interface RateInterval {
  start: Date;
  end: Date;
  value: number; // pence (inc. VAT)
}

export interface MeterPoint {
  mpan: string;
  serialNumber: string;
  productCode: string;
  tariffCode: string;
}

const BASE_URL = (): string => config.octopus.base_url ?? 'https://api.octopus.energy';

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

export async function getMeterPoint(): Promise<MeterPoint> {
  const account = await request<any>(
    `${BASE_URL()}/v1/accounts/${config.octopus.account_number}/`
  );

  const property = account.properties?.[0];
  const meterPoint = property?.electricity_meter_points?.[0];
  const meter = meterPoint?.meters?.[0];
  const agreement = meterPoint?.agreements?.[meterPoint.agreements.length - 1];

  if (!meterPoint || !meter || !agreement) {
    throw new Error('Octopus account does not expose an electricity meter point with an agreement');
  }

  return {
    mpan: meterPoint.mpan,
    serialNumber: meter.serial_number,
    tariffCode: agreement.tariff_code,
    productCode: productCodeFromTariff(agreement.tariff_code)
  };
}

export async function getConsumption(meterPoint: MeterPoint, since: Date, until: Date): Promise<ConsumptionInterval[]> {
  const url = `${BASE_URL()}/v1/electricity-meter-points/${meterPoint.mpan}/meters/${meterPoint.serialNumber}`
    + `/consumption/?period_from=${since.toISOString()}&period_to=${until.toISOString()}&page_size=25000&order_by=period`;

  const results = await requestAllPages<any>(url);

  return results.map(r => ({
    start: new Date(r.interval_start),
    end: new Date(r.interval_end),
    consumption: r.consumption
  }));
}

export async function getUnitRates(meterPoint: MeterPoint, since: Date, until: Date): Promise<RateInterval[]> {
  const url = `${BASE_URL()}/v1/products/${meterPoint.productCode}/electricity-tariffs/${meterPoint.tariffCode}`
    + `/standard-unit-rates/?period_from=${since.toISOString()}&period_to=${until.toISOString()}&page_size=25000`;

  return mapRates(await requestAllPages<any>(url));
}

export async function getStandingCharges(meterPoint: MeterPoint, since: Date, until: Date): Promise<RateInterval[]> {
  const url = `${BASE_URL()}/v1/products/${meterPoint.productCode}/electricity-tariffs/${meterPoint.tariffCode}`
    + `/standing-charges/?period_from=${since.toISOString()}&period_to=${until.toISOString()}&page_size=25000`;

  return mapRates(await requestAllPages<any>(url));
}

function mapRates(results: any[]): RateInterval[] {
  return results
    .map(r => ({
      // `valid_to` is null for the current open-ended rate.
      start: new Date(r.valid_from),
      end: r.valid_to ? new Date(r.valid_to) : new Date(8640000000000000),
      value: r.value_inc_vat
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function isConfigured(): boolean {
  const configured = Boolean(config.octopus?.api_key && config.octopus?.account_number);

  if (!configured) {
    logger.warn('Octopus service is not configured; skipping');
  }

  return configured;
}
