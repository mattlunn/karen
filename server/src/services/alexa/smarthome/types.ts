export interface AlexaRequestHeader {
  messageId: string;
  payloadVersion: number | string;
}

export interface AlexaRequestEndpoint {
  scope: { type: string; token: string };
  endpointId: string;
}

// Requests (inbound directives from Alexa → Karen)

export interface AlexaAcceptGrantRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.Authorization'; name: 'AcceptGrant' };
  payload: { grant: { code: string }; grantee: { type: string; token: string } };
}

export interface AlexaDiscoverRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.Discovery'; name: 'Discover' };
  payload: Record<string, never>;
}

export interface AlexaReportStateRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa'; name: 'ReportState' };
  endpoint: AlexaRequestEndpoint;
  payload: Record<string, never>;
}

export interface AlexaTurnOnOffRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.PowerController'; name: 'TurnOn' | 'TurnOff' };
  endpoint: AlexaRequestEndpoint;
  payload: Record<string, never>;
}

export interface AlexaSetBrightnessRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.BrightnessController'; name: 'SetBrightness' };
  endpoint: AlexaRequestEndpoint;
  payload: { brightness: number };
}

export interface AlexaAdjustBrightnessRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.BrightnessController'; name: 'AdjustBrightness' };
  endpoint: AlexaRequestEndpoint;
  payload: { brightnessDelta: number };
}

export type AlexaBrightnessRequest = AlexaSetBrightnessRequest | AlexaAdjustBrightnessRequest;

export interface AlexaSecurityPanelRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.SecurityPanelController'; name: 'Arm' | 'Disarm' };
  endpoint: AlexaRequestEndpoint;
  payload: { armState?: string };
}

export interface AlexaSetCookingModeRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.Cooking'; name: 'SetCookingMode' };
  endpoint: AlexaRequestEndpoint;
  payload: { cookingMode: { value: string }; cookingPower?: { value: number; unit: string } };
}

export interface AlexaCookByTemperatureRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.Cooking.TemperatureController'; name: 'CookByTemperature' };
  endpoint: AlexaRequestEndpoint;
  payload: { targetCookingTemperature: { value: number; scale: 'CELSIUS' | 'FAHRENHEIT' | 'KELVIN' } };
}

export interface AlexaSetVolumeRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.Speaker'; name: 'SetVolume' };
  endpoint: AlexaRequestEndpoint;
  payload: { volume: number };
}

export interface AlexaAdjustVolumeRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.Speaker'; name: 'AdjustVolume' };
  endpoint: AlexaRequestEndpoint;
  payload: { volume: number; volumeDefault?: boolean };
}

export interface AlexaSetMuteRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.Speaker'; name: 'SetMute' };
  endpoint: AlexaRequestEndpoint;
  payload: { mute: boolean };
}

export type AlexaSpeakerRequest = AlexaSetVolumeRequest | AlexaAdjustVolumeRequest | AlexaSetMuteRequest;

export interface AlexaAdjustVolumeStepRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.StepSpeaker'; name: 'AdjustVolume' };
  endpoint: AlexaRequestEndpoint;
  payload: { volumeSteps: number; volumeStepsDefault?: boolean };
}

export interface AlexaSetMuteStepRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.StepSpeaker'; name: 'SetMute' };
  endpoint: AlexaRequestEndpoint;
  payload: { mute: boolean };
}

export type AlexaStepSpeakerRequest = AlexaAdjustVolumeStepRequest | AlexaSetMuteStepRequest;

export interface AlexaSelectInputRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.InputController'; name: 'SelectInput' };
  endpoint: AlexaRequestEndpoint;
  payload: { input: string };
}

export interface AlexaChangeChannelRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.ChannelController'; name: 'ChangeChannel' };
  endpoint: AlexaRequestEndpoint;
  payload: {
    channel?: { number?: string; callSign?: string; affiliateCallSign?: string };
    channelMetadata?: { name?: string; image?: string };
  };
}

export interface AlexaLaunchTargetRequest {
  header: AlexaRequestHeader & { namespace: 'Alexa.Launcher'; name: 'LaunchTarget' };
  endpoint: AlexaRequestEndpoint;
  payload: { name?: string; identifier: string };
}

export type AlexaSmartHomeRequest =
  | AlexaAcceptGrantRequest
  | AlexaDiscoverRequest
  | AlexaReportStateRequest
  | AlexaTurnOnOffRequest
  | AlexaBrightnessRequest
  | AlexaSecurityPanelRequest
  | AlexaSetCookingModeRequest
  | AlexaCookByTemperatureRequest
  | AlexaSpeakerRequest
  | AlexaStepSpeakerRequest
  | AlexaSelectInputRequest
  | AlexaChangeChannelRequest
  | AlexaLaunchTargetRequest;

// Responses (outbound from Karen → Alexa)

export interface AlexaDiscoveryCapability {
  type: 'AlexaInterface';
  interface: string;
  version: string;
  instance?: string;
  capabilityResources?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
  inputs?: { name: string }[];
  properties?: {
    supported: { name: string }[];
    configuration?: Record<string, unknown>;
    proactivelyReported: boolean;
    retrievable: boolean;
  };
}

export interface AlexaDiscoveryEndpoint {
  friendlyName: string;
  endpointId: string;
  displayCategories: string[];
  manufacturerName: string;
  description: string;
  capabilities: AlexaDiscoveryCapability[];
}
