// Import and re-export shared types from server API
import type {
  AlarmMode,
  AlarmStatusResponse as AlarmApiResponse,
  BooleanEventApiResponse,
  NumericEventApiResponse,
  RestDeviceResponse,
  DevicesApiResponse,
  DeviceApiResponse
} from '../../../../server/src/api/types';

export type {
  AlarmMode,
  AlarmApiResponse,
  BooleanEventApiResponse,
  NumericEventApiResponse,
  RestDeviceResponse,
  DevicesApiResponse,
  DeviceApiResponse
};
