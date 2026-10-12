import { DishwasherBaseCapability } from './capabilities.gen';
import { Device } from '..';
import { DishwasherScheduledRun } from './index';
import type { Meal } from '../../api/types';

export class DishwasherCapability extends DishwasherBaseCapability {
  getScheduledRun(): DishwasherScheduledRun | null {
    return Device.getProviderCapabilities(this.device.provider)
      .provideDishwasherCapability!()
      .getScheduledRun(this.device);
  }

  async toggleMealSchedule(meal: Meal): Promise<DishwasherScheduledRun | null> {
    const provider = Device.getProviderCapabilities(this.device.provider).provideDishwasherCapability!();

    if (provider.getScheduledRun(this.device)?.meal === meal) {
      await provider.cancelScheduledRun(this.device);

      return null;
    }

    return provider.scheduleForMeal(this.device, meal);
  }
}
