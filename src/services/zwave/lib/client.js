import ws from 'ws';
import config from '../../../config';
import uuid from 'uuid/v4';
import { EventEmitter } from 'events';

export default new Promise((res, rej) => {
  const socket = new ws(`ws://${config.zwave.host}`);
  const events = new EventEmitter();
  const recentEvents = new Set();
  const msgs = new Map();

  /*
    { "messageId": "1", "command": "set_api_schema", "schemaVersion": 20 }
    { "messageId": "2", "command": "start_listening" }
    { "messageId": "3", "command": "controller.get_state" }
  */

  function request(command, data = {}) {
    const id = uuid();
    const msg = typeof command === 'object' 
      ? { ...command }
      : { command, ...data }

    msg.messageId = id;

    return new Promise((resolve, reject) => {
      msgs.set(id, { resolve, reject });
      socket.send(JSON.stringify(msg));
    });
  }

  socket.on('open', async () => {
    await request('set_api_schema', { schemaVersion: 20 });
    
    const { state: { nodes }} = await request('start_listening');

    res({ 
      request, 
      nodes, 
      on(event, listener) {
        events.on(event, listener);
      }
    });
  });

  socket.on('message', (data) => {
    const dataAsString = data.toString();
    const message = JSON.parse(dataAsString);

    if (process.env.NODE_ENV === 'development') {
      console.log(message);
    }

    switch (message.type) {
      case 'result': {
        const { success, messageId, result } = message;
        const promise = msgs.get(messageId);

        if (typeof promise !== 'undefined') {
          msgs.delete(messageId);
          return promise[success ? 'resolve' : 'reject'](result);
        }
        
        break;
      }

      case 'event': {
        // zwave-js sends all events twice, for whatever reason.
        if (!recentEvents.has(dataAsString)) {
          recentEvents.add(dataAsString);
          events.emit('event', message.event);

          setTimeout(() => {
            recentEvents.delete(dataAsString);
          }, 100);
        }

        break;
      }
      
      default: {
        console.error(`Did not understand the following message from zwave-js-server`);
        console.error(JSON.stringify(message));
      }
    }
  });

  socket.on('error', (e) => {
    console.log('error');
    console.error(e);
  });

  socket.on('close', (e) => {
    console.log('closed');
    console.error(e);
  });
});