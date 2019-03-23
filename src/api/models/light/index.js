import LightwaveRfLight from './lightwave';
import TpLinkLight from './tplink';

export default function (data, context) {
  return data.map((item) => {
    switch (item.provider) {
      case 'lightwaverf':
        return new LightwaveRfLight(item, context);
      case 'tplink':
        return new TpLinkLight(item, context);
      default:
        throw new Error(`${item.provider} is not a recognised light provider`);
    }
  });
}