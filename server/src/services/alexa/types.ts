export interface AlexaDirectiveBaseHeader {
  messageId: string;
  payloadVersion: number | string;
}

export interface AlexaDirectiveEndpoint {
  scope: { type: string; token: string };
  endpointId: string;
}

export interface AlexaAcceptGrantDirective {
  header: AlexaDirectiveBaseHeader & { namespace: 'Alexa.Authorization'; name: 'AcceptGrant' };
  payload: { grant: { code: string }; grantee: { type: string; token: string } };
}

export interface AlexaDiscoverDirective {
  header: AlexaDirectiveBaseHeader & { namespace: 'Alexa.Discovery'; name: 'Discover' };
  payload: Record<string, never>;
}

export interface AlexaReportStateDirective {
  header: AlexaDirectiveBaseHeader & { namespace: 'Alexa'; name: 'ReportState' };
  endpoint: AlexaDirectiveEndpoint;
  payload: Record<string, never>;
}

export interface AlexaTurnOnOffDirective {
  header: AlexaDirectiveBaseHeader & { namespace: 'Alexa.PowerController'; name: 'TurnOn' | 'TurnOff' };
  endpoint: AlexaDirectiveEndpoint;
  payload: Record<string, never>;
}

export interface AlexaSetBrightnessDirective {
  header: AlexaDirectiveBaseHeader & { namespace: 'Alexa.BrightnessController'; name: 'SetBrightness' };
  endpoint: AlexaDirectiveEndpoint;
  payload: { brightness: number };
}

export interface AlexaAdjustBrightnessDirective {
  header: AlexaDirectiveBaseHeader & { namespace: 'Alexa.BrightnessController'; name: 'AdjustBrightness' };
  endpoint: AlexaDirectiveEndpoint;
  payload: { brightnessDelta: number };
}

export type AlexaBrightnessDirective = AlexaSetBrightnessDirective | AlexaAdjustBrightnessDirective;

export interface AlexaSecurityPanelDirective {
  header: AlexaDirectiveBaseHeader & { namespace: 'Alexa.SecurityPanelController'; name: 'Arm' | 'Disarm' };
  endpoint: AlexaDirectiveEndpoint;
  payload: { armState?: string };
}

export type AlexaSmartHomeDirective =
  | AlexaAcceptGrantDirective
  | AlexaDiscoverDirective
  | AlexaReportStateDirective
  | AlexaTurnOnOffDirective
  | AlexaBrightnessDirective
  | AlexaSecurityPanelDirective;
