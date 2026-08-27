export interface AlexaIntent {
  name: string;
  slots: Record<string, unknown>;
}

export interface AlexaSkillRequest {
  type: string;
  // Absent on LaunchRequest and SessionEndedRequest, which Alexa can send to any skill.
  intent?: AlexaIntent;
}

export interface AlexaSkillRequestBody {
  version: string;
  context: {
    System: {
      application: {
        applicationId: string;
      };
    };
  };
  request: AlexaSkillRequest;
}
