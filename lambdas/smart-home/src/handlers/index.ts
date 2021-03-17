import { SmartHomeHandler } from "../custom-typings/lambda";
import * as AlexaDiscovery from './discovery';
import * as AlexaPowerController from './power-controller';
import * as Alexa from './alexa';
import * as AlexaBrightnessController from './brightness-controller';

export default {
  'Alexa': Alexa,
  'Alexa.Discovery': AlexaDiscovery,
  'Alexa.PowerController': AlexaPowerController,
  'Alexa.BrightnessController': AlexaBrightnessController
} as unknown as Record<string, Record<string, SmartHomeHandler>>;
