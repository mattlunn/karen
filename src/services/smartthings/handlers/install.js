import config from '../../../config';
import { saveConfig } from '../../../helpers/config';

export default function (data) {
  config.smartthings.refresh_token = data.installData.refreshToken;
  saveConfig();

  return {
    installData: {}
  };
}