const API_BASE = 'https://api.home-connect.com/api';

export type Appliance = {
  connected: boolean;
  haId: string;
  name: string;
  type: string;
};

export type ProgramOption = {
  key: string;
  value: number | string | boolean;
  unit?: string;
};

export type Program = {
  key: string;
  options: ProgramOption[];
};

export default class ApiClient {
  #getAccessToken: () => Promise<string>;

  constructor(getAccessToken: () => Promise<string>) {
    this.#getAccessToken = getAccessToken;
  }

  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.#getAccessToken()}`,
        Accept: 'application/vnd.bsh.sdk.v1+json',
        'Content-Type': 'application/vnd.bsh.sdk.v1+json',
      },
    });

    if (res.status === 204) {
      return null;
    }

    const body = await res.json();

    if (!res.ok) {
      throw new Error(body.error?.description ?? `Home Connect API returned ${res.status} for ${path}`);
    }

    return body.data;
  }

  async getAppliances(): Promise<Appliance[]> {
    const data = await this.#request('/homeappliances') as { homeappliances: Appliance[] };

    return data.homeappliances;
  }

  async getSelectedProgram(haId: string): Promise<Program> {
    const data = await this.#request(`/homeappliances/${haId}/programs/selected`) as { key: string; options?: ProgramOption[] };

    return { key: data.key, options: data.options ?? [] };
  }

  async startProgram(haId: string, program: Program): Promise<void> {
    await this.#request(`/homeappliances/${haId}/programs/active`, {
      method: 'PUT',
      body: JSON.stringify({ data: program }),
    });
  }

  async setActiveProgramOption(haId: string, option: ProgramOption): Promise<void> {
    await this.#request(`/homeappliances/${haId}/programs/active/options/${option.key}`, {
      method: 'PUT',
      body: JSON.stringify({ data: option }),
    });
  }

  async stopActiveProgram(haId: string): Promise<void> {
    await this.#request(`/homeappliances/${haId}/programs/active`, { method: 'DELETE' });
  }
}
