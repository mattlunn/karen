import dayjs from '../../../dayjs';
import logger from '../../../logger';
import { TariffAgreement } from './octopus';

export interface ForecastRate {
  start: Date;
  value: number; // pence, predicted
}

const FORECAST_BASE_URL = 'https://agilepredict.com/api';

// The same trailing letter that identifies a tariff's GSP region (see
// productCodeFromTariff in ./octopus) is also the region code AgilePredict
// expects, e.g. `E-1R-AGILE-FLEX-22-11-25-C` -> region `C`.
function regionCodeFromTariff(tariffCode: string): string {
  return tariffCode.slice(-1);
}

// A separate unauthenticated fetch, deliberately not routed through the
// Octopus client's `request()` - that always attaches Octopus's own API key,
// which has no business being sent to this unrelated third-party forecast
// service.
async function requestForecast<T>(url: string): Promise<T> {
  let response;

  try {
    response = await fetch(url);
  } catch (e: any) {
    throw new Error(`AgilePredict request to ${url} failed: ${e.message}`);
  }

  if (!response.ok) {
    throw new Error(`AgilePredict request to ${url} failed with HTTP status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Always fetched over the full horizon and cached per region, so one upstream
// call serves every consumer's window rather than each re-requesting this free
// third-party service for its own.
const FORECAST_DAYS = 7;
const CACHE_TTL_HOURS = 6;

let cached: { region: string; fetchedAt: Date; rates: ForecastRate[] } | null = null;
let inFlight: { region: string; rates: Promise<ForecastRate[]> } | null = null;

function fetchRegionForecast(region: string): Promise<ForecastRate[]> {
  // Trailing slash matters - without it the API 301s to this same URL.
  const url = `${FORECAST_BASE_URL}/${region}/?days=${FORECAST_DAYS}&high_low=false`;

  return requestForecast<{ prices: { date_time: string; agile_pred: number }[] }[]>(url)
    .then(([forecast]) => forecast.prices.map(p => ({ start: new Date(p.date_time), value: p.agile_pred })));
}

// The in-flight promise is shared, not just the result, so concurrent callers
// coalesce onto one request instead of all missing at once. A prediction hours
// past its refresh still beats no prices at all, so an unreachable origin
// serves the stale entry and only throws when nothing was ever cached.
async function getRegionForecast(region: string): Promise<ForecastRate[]> {
  if (cached !== null && cached.region === region && dayjs(cached.fetchedAt).add(CACHE_TTL_HOURS, 'hour').isAfter(new Date())) {
    return cached.rates;
  }

  if (inFlight === null || inFlight.region !== region) {
    inFlight = { region, rates: fetchRegionForecast(region) };
  }

  const pending = inFlight;

  try {
    const rates = await pending.rates;

    cached = { region, fetchedAt: new Date(), rates };

    return rates;
  } catch (e: any) {
    if (cached === null || cached.region !== region) {
      throw e;
    }

    logger.warn(`AgilePredict unreachable (${e.message}); serving rates fetched ${dayjs(cached.fetchedAt).fromNow()}`);

    return cached.rates;
  } finally {
    if (inFlight === pending) {
      inFlight = null;
    }
  }
}

export async function getForecastRates(agreements: TariffAgreement[], since: Date, until: Date): Promise<ForecastRate[]> {
  const current = agreements.find(a => a.validTo === null) ?? agreements.at(-1);

  if (current === undefined) {
    return [];
  }

  const rates = await getRegionForecast(regionCodeFromTariff(current.tariffCode));

  return rates.filter(r => r.start.getTime() >= since.getTime() && r.start.getTime() < until.getTime());
}
