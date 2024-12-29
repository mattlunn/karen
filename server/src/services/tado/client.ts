import fetch from 'node-fetch';
import config from '../../config';
import logger from '../../logger';
import { stringify } from 'querystring';

export type Token = {
  accessToken: string,
  expiresAt: number
};

export type ISODateTime = string;

export type ZoneActiveTimetable = {
  id: 0,
  type: "ONE_DAY"
} | {
  id: 1,
  type: "THREE_DAY"
} | {
  id: 2,
  type: "SEVEN_DAY"
};

export type ZoneSetting = {
  type: "HEATING",
  power: "ON" | "OFF",
} & ({ 
  power: "ON"
  temperature: {
    celsius: number,
    fahrenheit: number
  }
} | {
  power: "OFF"
  temperature: null
});

export type ZoneTimetableBlock = {
  dayType: "MONDAY_TO_SUNDAY" | "MONDAY_TO_FRIDAY",
  start: string,
  end: string,
  geolocationOverride: boolean,
  setting: ZoneSetting
};

export type ZoneState = {
  tadoMode: "HOME",
  setting: ZoneSetting,
  openWindow: null,
  nextScheduleChange: {
    start: ISODateTime,
    setting: ZoneSetting
  },
  nextTimeBlock: {
    start: ISODateTime
  },
  link: {
    state: "ONLINE"
  },
  runningOfflineSchedule: false,
  activityDataPoints: {
    heatingPower: {
      type: "PERCENTAGE",
      percentage: number,
      timestamp: ISODateTime
    }
  },
  sensorDataPoints: {
    insideTemperature: {
      celsius: number,
      fahrenheit: number,
      timestamp: ISODateTime,
      type: "TEMPERATURE",
      precision: {
        celsius: number,
        fahrenheit: number
      }
    },
    humidity: {
      type: "PERCENTAGE",
      percentage: number,
      timestamp: ISODateTime
    }
  }
 } & ({
  overlayType: "MANUAL",
  overlay: {
    type: "MANUAL",
    setting: ZoneSetting,
    termination: {
      type: "TIMER",
      typeSkillBasedApp: "NEXT_TIME_BLOCK" | "TIMER",
      durationInSeconds: number,
      expiry: ISODateTime,
      remainingTimeInSeconds: number,
      projectedExpiry: ISODateTime
    } | {
      type: "MANUAL",
      typeSkillBasedApp: "MANUAL",
      projectedExpiry: null
    }
  }
} | {
  overlayType: null,
  overlay: null
});

let token: Token | undefined;

export async function getAccessToken(): Promise<string> {
  if (!token || token.expiresAt < Date.now() + 1000 * 60) {
    const response = await fetch('https://auth.tado.com/oauth/token', {
      method: 'POST',
      body: stringify({
        client_id: 'tado-web-app',
        client_secret: 'wZaRN7rpjn3FoNyF5IFuxg9uMzYJcvOoQ8QWiIqS3hfk6gLhVlG57j5YNoZL2Rtc',
        grant_type: 'password',
        username: config.tado.username,
        password: config.tado.password,
        scope: 'home.user'
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      throw new Error(`Unable to get Access Token: HTTP status code was '${response.status}'`);
    }

    const { access_token, expires_in } = await response.json();

    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Tado access_token is '${access_token}'`);
    }

    token = {
      accessToken: access_token,
      expiresAt: Date.now() + (expires_in * 1000)
    };
  }

  return token.accessToken;
}

export default class TadoClient {
  private accessToken: string;
  private homeId: number;

  constructor(accessToken: string, homeId: number) {
    this.accessToken = accessToken;
    this.homeId = homeId;
  }

  async _request(url: string, body?: object | null, verb?: 'PUT' | 'GET' | 'DELETE') {
    const response = await fetch(`https://my.tado.com/api/v2/homes/${this.homeId}${url}`, {
      method: verb || (body ? 'PUT' : 'GET'),
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 204) {
      return Promise.resolve();
    }

    const json = await response.json();

    if (json.errors && json.errors.length) {
      throw new Error(`${json.errors[0].code}: ${json.errors[0].title}`);
    }

    return json;
  }

  getZones() {
    return this._request('/zones');
  }

  getZoneState(zone: string): Promise<ZoneState> {
    return this._request(`/zones/${zone}/state`);
  }

  async getActiveTimetable(zone: string): Promise<ZoneActiveTimetable> {
    const data = await this._request(`/zones/${zone}/schedule/activeTimetable`);

    return data.id;
  }

  getTimetableBlocks(zone: string, timetable: ZoneActiveTimetable["id"]): Promise<ZoneTimetableBlock> {
    return this._request(`/zones/${zone}/schedule/timetables/${timetable}/blocks`);
  }

  async getMinimumAwayTemperatureForZone(zone: string): Promise<number> {
    const data = await this._request(`/zones/${zone}/awayConfiguration`);

    return data.minimumAwayTemperature.celsius;
  }

  setHeatingPowerForZone(zone: string, value: number | false, endAtNextTimeBlock: boolean) {
    return this._request(`/zones/${zone}/overlay`, {
      setting: {
        type: 'HEATING',
        power: value === false ? 'OFF' : 'ON',
        temperature: value === false ? null : {
          celsius: value
        }
      },
      termination: {
        typeSkillBasedApp: endAtNextTimeBlock ? 'NEXT_TIME_BLOCK' : 'MANUAL'
      }
    });
  }

  endManualHeatingForZone(zone: string) {
    return this._request(`/zones/${zone}/overlay`, null, 'DELETE');
  }
}