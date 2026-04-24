import newrelic from 'newrelic';
import { SmartHomeHandler } from './custom-typings/lambda';
import handlers from './handlers';

export const handler: SmartHomeHandler = async function (request, context) {
  const interfaceName = request.directive.header.namespace;
  const interfaceHandler = request.directive.header.name;
  const start = Date.now();
  let success = false;

  console.log(JSON.stringify(request));

  try {
    if (!handlers.hasOwnProperty(interfaceName)) {
      throw new Error(`There is no handler for "${interfaceName}"`);
    }

    const handler = handlers[interfaceName];

    if (typeof handler[interfaceHandler] !== 'function') {
      throw new Error(`The "${interfaceName}" handler does not know how to handle "${interfaceHandler}"`);
    }

    const response = await handler[interfaceHandler](request, context);

    console.log(JSON.stringify(response));

    success = true;

    return response;
  } catch (e) {
    newrelic.noticeError(e as Error);
    throw e;
  } finally {
    newrelic.recordCustomEvent('AlexaSmartHomeRequest', {
      namespace: interfaceName,
      action: interfaceHandler,
      durationMs: Date.now() - start,
      success,
    });
  }
};
