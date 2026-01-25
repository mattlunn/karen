// Import and re-export shared types from server API
import type {
  DeviceStatus,
  AlarmMode,
  AlarmStatusResponse as AlarmApiResponse,
  BooleanEventApiResponse,
  NumericEventApiResponse,
  RestDeviceResponse,
  DevicesApiResponse,
  DeviceApiResponse
} from '../../../../server/src/api/types';

export type {
  DeviceStatus,
  AlarmMode,
  AlarmApiResponse,
  BooleanEventApiResponse,
  NumericEventApiResponse,
  RestDeviceResponse,
  DevicesApiResponse,
  DeviceApiResponse
};
