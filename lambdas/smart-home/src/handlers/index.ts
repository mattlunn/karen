import { SmartHomeHandler } from "../custom-typings/lambda";
import * as AlexaDiscovery from './discovery';
import * as AlexaPowerController from './power-controller';
import * as Alexa from './alexa';
import * as AlexaBrightnessController from './brightness-controller';
import * as AlexaSecurityPanelController from './security-panel-controller';
import * as AlexaAuthorization from './alexa-authorization';

export default {
  'Alexa': Alexa,
  'Alexa.Discovery': AlexaDiscovery,
  'Alexa.PowerController': AlexaPowerController,
  'Alexa.BrightnessController': AlexaBrightnessController,
  'Alexa.SecurityPanelController': AlexaSecurityPanelController,
  'Alexa.Authorization': AlexaAuthorization
} as unknown as Record<string, Record<string, SmartHomeHandler>>;
