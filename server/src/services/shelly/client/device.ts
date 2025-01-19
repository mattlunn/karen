import logger from '../../../logger';
import Gen1DeviceClient from './gen1-device';
import Gen3DeviceClient from './gen3-device';

export default class DeviceClient {
  static forGeneration(generation: number, ip: string, username: string, password: string): Gen1DeviceClient | Gen3DeviceClient { 
    switch (generation) {
      case 1:
        return new Gen1DeviceClient(ip, username, password);
      case 3:
        return new Gen3DeviceClient(ip, username, password);
      default:
        throw new Error(`Gen ${generation} is not supported`);
    }
  }

  static async for(ip: string, username: string, password: string) {
    const req = await fetch(`http://${ip}/shelly`);
    const data = await req.json();
    const generation = data.gen || 1;

    if (process.env.NODE_ENV === 'DEVELOPMENT') {
      logger.info(`Shelly - ${ip} has been identifed as generation ${generation}`);
    }

    return this.forGeneration(generation, ip, username, password);
  }
}