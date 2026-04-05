import { Device } from '../../models';
import config from '../../config';
import logger from '../../logger';
import type { Capability } from '../../models/capabilities';

interface BinConfig {
  id: string;
  name: string;
  color: string;
  anchorDate: string;
  intervalWeeks: number;
  overrides: Array<{ originalDate: string; newDate: string }>;
}

const bins: BinConfig[] = (config as unknown as { bins?: BinConfig[] }).bins ?? [];

Device.registerProvider('bins', {
  getCapabilities(): Capability[] {
    return ['BIN_COLLECTION'];
  },

  async synchronize() {
    for (const bin of bins) {
      try {
        let device = await Device.findByProviderId('bins', bin.id);

        if (device === null) {
          device = Device.build({
            provider: 'bins',
            providerId: bin.id,
          });
        }

        device.name = bin.name;
        device.manufacturer = 'Local Council';
        device.model = 'Bin Collection';
        await device.save();
      } catch (e) {
        logger.error(e, `Failed to synchronize bin device ${bin.id}`);
      }
    }
  },
});
