import config from '../../../config';
import { saveConfig } from '../../../helpers/config';

export default function (data) {
  config.smartthings.refresh_token = data.updateData.refreshToken;
  saveConfig();

  return {
    updateData: {}
  };
}