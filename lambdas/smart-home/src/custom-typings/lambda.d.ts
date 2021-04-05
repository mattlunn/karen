import { Context } from 'aws-lambda'

// https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-discovery.html
export interface SmartHomeRequest {
  directive: {
    header: {
      namespace: string
      name: string
      messageId: string
      payloadVersion: 3
    }
  }
}

export type SmartHomeEndpointRequest<Payload = undefined> = SmartHomeRequest & {
  directive: {
    endpoint: {
      scope: {
        type: 'BearerToken',
        token: string
      },
      endpointId: string
    },
    payload: T
  }
}

export type SmartHomeEndpointProperty = {
  namespace: string,
  name: string,
  value: any,
  timeOfSample: string,
  uncertaintyInMilliseconds: number
}

// https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-discovery.html
export interface SmartHomeResponse {
  event: {
    header: {
      namespace: string
      name: string
      messageId: string
      payloadVersion: 3
    }
  }
}

export type SmartHomeEndpointResponse = SmartHomeResponse & {
  event: {
    endpoint: {
      scope: {
        type: 'BearerToken',
        token: string
      },
      endpointId: string
    }
  }
}

export type SmartHomeEndpointAndPropertiesResponse = SmartHomeEndpointResponse & {
  context: {
    properties: SmartHomeEndpointProperty[]
  }
}

export type SmartHomeErrorResponse = SmartHomeEndpointResponse & {
  event: {
    header: {
      namespace: 'Alexa'
      name: 'ErrorResponse'
      messageId: string
      payloadVersion: 3
    },
    payload: {
      type: string
      message: string
    }
  }
}

// https://github.com/DefinitelyTyped/DefinitelyTyped/issues/38342
export type SmartHomeHandler = (
  event: SmartHomeRequest,
  context: Context,
) => Promise<SmartHomeResponse | SmartHomeErrorResponse>

export type Context = Context