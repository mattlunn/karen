import config from '../../config';

export type ServiceStatus =
  | { kind: 'on-time'; scheduled: string; platform: string | null }
  | { kind: 'delayed'; scheduled: string; estimated: string; platform: string | null }
  | { kind: 'cancelled'; scheduled: string; reason: string | null }
  | { kind: 'not-found'; scheduled: string };

interface TrainService {
  std: string;
  etd: string;
  platform: string | null;
  isCancelled?: boolean;
  cancelReason?: string | null;
  delayReason?: string | null;
}

interface DepartureBoardResponse {
  trainServices: TrainService[] | null;
}

const BASE_URL = 'https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120';

async function request<T>(url: string): Promise<T> {
  let response;

  try {
    response = await fetch(url, {
      headers: {
        'x-apikey': config.raildata.api_key
      }
    });
  } catch (e: any) {
    throw new Error(`Rail Data request to ${url} failed: ${e.message}`);
  }

  if (!response.ok) {
    throw new Error(`Rail Data request to ${url} failed with HTTP status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getServiceStatus(
  fromCrs: string,
  toCrs: string,
  scheduledDeparture: string
): Promise<ServiceStatus> {
  const url = `${BASE_URL}/GetDepBoardWithDetails/${encodeURIComponent(fromCrs)}`
    + `?filterCrs=${encodeURIComponent(toCrs)}&filterType=to`;

  const board = await request<DepartureBoardResponse>(url);
  const service = (board.trainServices ?? []).find(s => s.std === scheduledDeparture);

  if (!service) {
    return { kind: 'not-found', scheduled: scheduledDeparture };
  }

  const platform = service.platform ?? null;

  if (service.isCancelled || service.etd === 'Cancelled') {
    return {
      kind: 'cancelled',
      scheduled: scheduledDeparture,
      reason: service.cancelReason ?? null
    };
  }

  if (service.etd === 'On time') {
    return { kind: 'on-time', scheduled: scheduledDeparture, platform };
  }

  return {
    kind: 'delayed',
    scheduled: scheduledDeparture,
    estimated: service.etd,
    platform
  };
}
