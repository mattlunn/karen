import ws from 'ws';
import config from '../../../config';
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import newrelic from 'newrelic';

const BACKOFFS = [0, 1, 5, 60];

let alwaysAPromiseOfAClient = (function getClient(retryCount = 0) {
  const promise = new Promise((res, rej) => {
    setTimeout(() => {
      const socket = new ws(`wss://${config.zwave.user}:${config.zwave.password}@${config.zwave.host}`);
      const events = new EventEmitter();
      const recentEvents = new Set();
      const msgs = new Map();
      const nodes = new Map();

      /*
        { "messageId": "1", "command": "set_api_schema", "schemaVersion": 20 }
        { "messageId": "2", "command": "start_listening" }
        { "messageId": "3", "command": "controller.get_state" }
        { "messageId": "4", "command": "controller.begin_inclusion" }
      */      
    
      function makeRequest(command, data = {}) {
        const id = uuid();
        const msg = typeof command === 'object' 
          ? { ...command }
          : { command, ...data };
    
        msg.messageId = id;
    
        return new Promise((resolve, reject) => {
          msgs.set(id, { resolve, reject });
          socket.send(JSON.stringify(msg));
        });
      }
    
      socket.on('open', async () => {
        await makeRequest('set_api_schema', { schemaVersion: 20 });
        
        const initialState = await makeRequest('start_listening');
    
        for (const node of initialState.state.nodes) {
          nodes.set(node.nodeId, node);
        }
        
        retryCount = 0;
    
        res({
          makeRequest,
          getNodes() {
            return nodes.values();
          },
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
    
              if (message.event.source === 'node' && message.event.event === 'ready') {
                nodes.set(message.event.nodeState.nodeId, message.event.nodeState);
              }
      
              if (message.event.source === 'controller' && message.event.event === 'node removed') {
                nodes.delete(message.event.nodeState.nodeId);
              }
    
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
        newrelic.noticeError(e);
        rej(e);
      });
    
      socket.on('close', (e) => {
        rej(e);
      });
    }, BACKOFFS[Math.min(retryCount, BACKOFFS.length - 1)] * 1000);
  });
  
  promise.catch(() => {
    // Putting this here so that we don't accidentally trigger more than 1, if both socket error 
    // and socket close fire.
    alwaysAPromiseOfAClient = getClient(retryCount + 1);
  });
  
  return promise;
})();

export default function () {
  return alwaysAPromiseOfAClient;
}