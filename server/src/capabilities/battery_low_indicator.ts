import { Capability } from '.';
import { Device } from '../models';
import { booleanProperty } from './helpers';

export type BatteryLowCapabilityProviderHandlers = never;

@booleanProperty('IsBatteryLow', { dbName: 'battery_low' })
export default class BatteryLowIndicatorCapability extends Capability<BatteryLowIndicatorCapability, BatteryLowCapabilityProviderHandlers> {
  constructor(device: Device) {
    super(device, undefined);
  }

  declare getIsBatteryLow: () => Promise<boolean>;
  declare setIsBatteryLowState: (isLow: boolean) => Promise<void>;
}