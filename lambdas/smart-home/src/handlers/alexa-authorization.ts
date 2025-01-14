import { Context, SmartHomeRequest, SmartHomeResponse } from "../custom-typings/lambda";
import fetch from 'cross-fetch';

export async function AcceptGrant(request: SmartHomeRequest<{ grant: { code: string }}>, context: Context): Promise<SmartHomeResponse<{ type?: 'ACCEPT_GRANT_FAILED', message?: string }>> {
  try {
    const res = await fetch(`https://${process.env.KAREN_HOST}/alexa/grant`, {
      method: 'POST',
      body: JSON.stringify({
        code: request.directive.payload.grant.code
      }),
      headers: {
        Authorization: `Bearer ${process.env.KAREN_AUTH_TOKEN}`
      }
    });

    if (!res.ok) {
      throw new Error(`Karen returned a ${res.status} during grant acceptance`);
    }
  } catch (e: any) {
    return {
      event: {
        header: {
          ...request.directive.header,
          name: 'ErrorResponse'
        },
        payload: {
          type: 'ACCEPT_GRANT_FAILED',
          message: e.message
        }
      }
    };
  }

  return {
    event: {
      header: {
        ...request.directive.header,
        name: 'AcceptGrant.Response'
      }
    }
  };
}