import { SmartHomeHandler } from './custom-typings/lambda';
import handlers from './handlers';

export const handler: SmartHomeHandler = async function (request, context) {
  console.log(JSON.stringify(request));

  const interfaceName = request.directive.header.namespace;
  const interfaceHandler = request.directive.header.name;

  if (handlers.hasOwnProperty(interfaceName)) {
    const handler = handlers[interfaceName];

    if (typeof handler[interfaceHandler] === 'function') {
      const response = await handler[interfaceHandler](request, context);

      console.log(JSON.stringify(response));

      return response;
    }

    throw new Error(`The "${interfaceName}" handler does not know how to handle "${interfaceHandler}"`);
  }

  throw new Error(`There is no handler for "${interfaceName}"`);
};

