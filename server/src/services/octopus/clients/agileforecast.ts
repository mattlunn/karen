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

export async function getForecastRates(agreements: TariffAgreement[], since: Date, until: Date): Promise<ForecastRate[]> {
  const current = agreements.find(a => a.validTo === null) ?? agreements.at(-1);

  if (current === undefined) {
    return [];
  }

  const region = regionCodeFromTariff(current.tariffCode);
  const days = Math.max(1, Math.ceil((until.getTime() - since.getTime()) / (24 * 60 * 60 * 1000)));
  const url = `${FORECAST_BASE_URL}/${region}?days=${days}&high_low=false`;
  const [forecast] = await requestForecast<{ prices: { date_time: string; agile_pred: number }[] }[]>(url);

  return forecast.prices
    .map(p => ({ start: new Date(p.date_time), value: p.agile_pred }))
    .filter(r => r.start.getTime() >= since.getTime() && r.start.getTime() < until.getTime());
}
