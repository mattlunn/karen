export interface AlexaIntent {
  name: string;
  slots: Record<string, unknown>;
}

export interface AlexaSkillRequest {
  type: string;
  intent: AlexaIntent;
}

export interface AlexaSkillRequestBody {
  request: AlexaSkillRequest;
}
