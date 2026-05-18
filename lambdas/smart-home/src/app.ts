import { Context } from 'aws-lambda';
import newrelic from 'newrelic';
import { apiPost } from './client';

export const handler = async function (event: unknown, _context: Context): Promise<unknown> {
  const directive = (event as { directive?: { header?: { namespace?: string; name?: string }; endpoint?: { endpointId?: string } } }).directive;
  const namespace = directive?.header?.namespace ?? 'Unknown';
  const actionName = directive?.header?.name ?? 'Unknown';
  const endpointId = directive?.endpoint?.endpointId;

  newrelic.setTransactionName(`${namespace}/${actionName}`);
  newrelic.addCustomAttributes({
    'alexa.namespace': namespace,
    'alexa.action': actionName,
    ...(endpointId !== undefined && { 'alexa.endpointId': endpointId }),
  });

  return apiPost('/alexa/smarthome', event);
};
