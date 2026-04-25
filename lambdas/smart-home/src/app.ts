import newrelic from 'newrelic';
import { SmartHomeHandler } from './custom-typings/lambda';
import handlers from './handlers';

export const handler: SmartHomeHandler = async function (request, context) {
  const interfaceName = request.directive.header.namespace;
  const interfaceHandler = request.directive.header.name;

  console.log(JSON.stringify(request));

  newrelic.addCustomAttributes({
    'alexa.namespace': interfaceName,
    'alexa.action': interfaceHandler,
  });

  if (!handlers.hasOwnProperty(interfaceName)) {
    throw new Error(`There is no handler for "${interfaceName}"`);
  }

  const handler = handlers[interfaceName];

  if (typeof handler[interfaceHandler] !== 'function') {
    throw new Error(`The "${interfaceName}" handler does not know how to handle "${interfaceHandler}"`);
  }

  const response = await handler[interfaceHandler](request, context);

  console.log(JSON.stringify(response));

  return response;
};
