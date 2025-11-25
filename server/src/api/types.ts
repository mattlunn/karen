export type DeviceApiResponse = {
  device: {
    id: number;
    name: string;
    type: string;
    provider: string;
    providerId: string;
  }
}