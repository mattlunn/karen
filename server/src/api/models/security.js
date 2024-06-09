import { Arming } from '../../models';

export default class Security {
  async alarmMode() {
    const activeArming = await Arming.getActiveArming(Date.now());

    return activeArming ? activeArming.mode : 'OFF';
  }

  cameras(_, { cameras }) {
    return cameras.load();
  }
}