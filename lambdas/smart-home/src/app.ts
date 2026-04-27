import { Context } from 'aws-lambda';
import { apiPost } from './client';

export const handler = async function (event: unknown, _context: Context): Promise<unknown> {
  return apiPost('/alexa/endpoint', event);
};
