import { Device } from '../../models';
import config from '../../config';
import logger from '../../logger';
import type { Capability } from '../../models/capabilities';

const items = config.bins?.items ?? [];

Device.registerProvider('bins', {
  getCapabilities(): Capability[] {
    return ['BIN_COLLECTION'];
  },

  async synchronize() {
    for (const bin of items) {
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
