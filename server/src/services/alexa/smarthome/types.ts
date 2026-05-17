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

export type AlexaSmartHomeRequest =
  | AlexaAcceptGrantRequest
  | AlexaDiscoverRequest
  | AlexaReportStateRequest
  | AlexaTurnOnOffRequest
  | AlexaBrightnessRequest
  | AlexaSecurityPanelRequest;

// Responses (outbound from Karen → Alexa)

export interface AlexaDiscoveryCapability {
  type: 'AlexaInterface';
  interface: string;
  version: string;
  instance?: string;
  capabilityResources?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
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
