import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import * as db from '../models';
import { User, Stay, Security, Camera, Lighting, Thermostat, Heating, Light, History, MotionEvent, ArrivalEvent, DepartureEvent, LightOnEvent, LightOffEvent, Device, Recording, AlarmArmingEvent, DoorbellRingEvent } from './models';
import { HOME, AWAY } from '../constants/status';
import moment from 'moment-timezone';
import makeSynologyRequest from '../services/synology/instance';
import UnorderedDataLoader from './lib/unordered-dataloader';
import DataLoaderWithNoIdParam from './lib/dataloader-with-no-id-param';
import schema from './schema';
import bus, { DEVICE_PROPERTY_CHANGED } from '../bus';
import createNewRelicPlugin from '@newrelic/apollo-server-plugin';
import logger from '../logger';

function createSubscriptionForDeviceType(deviceType, mapper, properties) {
  return {
    subscribe(_, { id }) {
      let ended = false;

      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return new Promise((res) => {
                bus.once(DEVICE_PROPERTY_CHANGED, ({ device, property }) => {
                  if (ended) {
                    res({ done: true });
                  } else {
                    if (device.type !== deviceType) {
                      return;
                    }

                    if (id && device.id !== Number(id)) {
                      return;
                    }

                    if (Array.isArray(properties) && !properties.includes(property)) {
                      return;
                    }

                    res({ done: false, value: mapper(device) });
                  }
                });
              });
            },

            return() {
              ended = true;

              return Promise.resolve({
                done: true
              });
            }
          };
        }
      };
    }
  };
}

const resolvers = {
  Query: {
    async getUsers(parent, args, context, info) {
      const users = await db.User.findAll();

      return users.map(user => new User(user, context));
    },

    async getSecurityStatus(parent, args, context, info) {
      return new Security(context);
    },

    async getLighting(parent, args, context, info) {
      return new Lighting(context);
    },

    async getHeating(parent, args, context, info) {
      return new Heating(context);
    },

    async getHistory(parent, args, context, info) {
      return new History(args);
    },

    async getDevice(parent, args, context, info) {
      const device = await db.Device.findById(args.id);

      if (!device) {
        throw new Error(`Device '${args.id}' does not exist.`);
      }

      return {
        type: device.type,
        device: Device.create(device)
      };
    },
    
    async getDevices(parent, args, context, info) {
      const devices = await db.Device.findAll();

      return devices.map((device) => ({
        type: device.type,
        device: Device.create(device)
      }));
    },

    async getTimeline(parent, { since, limit }, context, info) {
      const events = await Promise.all([
        db.Event.findAll({
          order: [['start', 'DESC']],
          where: {
            start: {
              [db.Op.lt]: since
            },
            type: {
              [db.Op.in]: ['motion', 'on', 'ring']
            }
          },
          limit
        }).then((events) => {
          return events.map((event) => {
            switch (event.type) {
              case 'motion':
                return [
                  new MotionEvent(event)
                ];
              case 'on': {
                const ret = [new LightOnEvent(event)];
    
                if (event.end) {
                  ret.push(new LightOffEvent(event));
                }
    
                return ret;
              }
              case 'ring': {
                return [
                  new DoorbellRingEvent(event)
                ];
              }
            }
          }).flat();
        }),

        db.Stay.findAll({
          where: {
            arrival: {
              [db.Op.lt]: since
            }
          },

          limit,
          order: [['arrival', 'DESC']],
        }).then((stays) => stays.map((stay) => new ArrivalEvent(stay))),

        db.Stay.findAll({
          where: {
            departure: {
              [db.Op.lt]: since
            }
          },

          limit,
          order: [['departure', 'DESC']],
        }).then((stays) => stays.map((stay) => new DepartureEvent(stay))),

        db.Arming.findAll({
          order: [['start', 'DESC']],
          where: {
            start: {
              [db.Op.lt]: since
            }
          },
          limit
        }).then((armings) => {
          return armings.map((arming) => {
            const ret = [new AlarmArmingEvent(arming, false)];

            if (arming.end) {
              ret.push(new AlarmArmingEvent(arming, true));
            }

            return ret;
          }).flat();
        }),
      ]);

      return events.flat().sort((a, b) => {
        const aTimestamp = a.timestamp();
        const bTimestamp = b.timestamp();

        if (aTimestamp instanceof Promise || bTimestamp instanceof Promise) {
          throw new Error('timestamp() cannot return a Promise for Events');
        }

        return bTimestamp - aTimestamp;
      }).slice(0, limit);
    }
  },

  Mutation: {
    async updateLight(parent, args, context, info) {
      const light = await db.Device.findById(args.id);

      if ('brightness' in args) {
        await light.setProperty('brightness', args.brightness);
      } else if ('isOn' in args) {
        await light.setProperty('on', args.isOn);
      }

      return new Light(light);
    },

    async updateThermostat(parent, args, context, info) {
      const thermostat = await db.Device.findById(args.id);
      await thermostat.setProperty('target', args.targetTemperature);

      return new Thermostat(thermostat);
    },

    async updateAlarm(parent, args, context, info) {
      const currentStatus = await db.Arming.getActiveArming();
      const desiredStatus = args.mode;
      const now = new Date();

      if ((currentStatus === null && desiredStatus === 'OFF') || currentStatus?.mode === args.mode) {
        return new Security();
      }

      if (currentStatus !== null) {
        currentStatus.end = now;
        await currentStatus.save();
      }

      if (desiredStatus !== 'OFF') {
        await db.Arming.create({
          start: now,
          mode: desiredStatus
        });
      }

      return new Security();
    },

    async updateUser(parent, args, context, info) {
      const user = await db.User.findOne({
        where: {
          handle: args.id
        }
      });

      if (!user) {
        throw new Error('User does not exist');
      }

      let [[current], [upcoming]] = await Promise.all([
        db.Stay.findCurrentOrLastStays([user.id]),
        db.Stay.findUpcomingStays([user.id]),
      ]);

      switch (args.status) {
        case HOME:
          if (current.departure !== null) {
            if (!upcoming) {
              upcoming = new db.Stay();
              upcoming.userId = user.id;
            }

            upcoming.arrival = new Date();

            current = upcoming;
            upcoming = null;

            await current.save();
          }

          break;
        case AWAY:
          if (current.departure === null) {
            current.departure = new Date();
            await current.save();
          }

          break;
      }

      if (args.eta) {
        const eta = moment(args.eta);

        if (current.departure === null) {
          throw new Error(`${user.handle} is currently at home. User must be away to set an ETA`);
        }

        if (eta.isBefore(moment())) {
          throw new Error(`ETA (${args.eta}) cannot be before the current time`);
        }

        if (!upcoming) {
          upcoming = new db.Stay();
          upcoming.userId = user.id;
        }

        upcoming.eta = eta;

        await upcoming.save();
      }

      context.upcomingStayByUserId.prime(user.id, upcoming);
      context.currentOrLastStayByUserId.prime(user.id, current);

      return new User(user, context);
    }
  },

  TimelineEvent: {
    __resolveType(obj, context, info) {
      return obj.constructor.name;
    }
  },

  Device: {
    __resolveType(obj, context, info) {
      return obj.constructor.name;
    }
  },

  HistoryDatumType: {
    __resolveType(obj, context, info) {
      return obj._device.type[0].toUpperCase() + obj._device.type.slice(1);
    }
  }

  /*
  Subscription: {
    onThermostatChanged: createSubscriptionForDeviceType('thermostat', device => ({ onThermostatChanged: new Thermostat(device) })),
    onLightChanged: createSubscriptionForDeviceType('light', device => ({ onLightChanged: new Light(device) }), ['on', 'brightness'])
  }
  */
};

export default async function() {
  const server = new ApolloServer({
    includeStacktraceInErrorResponses: true,
    typeDefs: schema,
    resolvers,
    plugins: [createNewRelicPlugin],
    formatError(error) {
      logger.error(`${error.message}: ${error.extensions.stacktrace.join('\n')}`);

      return error;
    }
  });

  await server.start();
  
  return expressMiddleware(server, {
    async context({ req }) {
      return {
        req: req,
        userByHandle: new UnorderedDataLoader(db.User.findByHandles.bind(db.User), ({ handle }) => handle, user => new User(user)),
        upcomingStayByUserId: new UnorderedDataLoader(db.Stay.findUpcomingStays.bind(db.Stay), ({ userId }) => userId, stay => new Stay(stay)),
        currentOrLastStayByUserId: new UnorderedDataLoader(db.Stay.findCurrentOrLastStays.bind(db.Stay), ({ userId }) => userId, stay => new Stay(stay)),
        cameras: new DataLoaderWithNoIdParam(async () => {
          const response = await makeSynologyRequest('SYNO.SurveillanceStation.Camera', 'List');

          return response.data.cameras;
        }, (cameras) => cameras.map(data => new Camera(data))),
        lights: new DataLoaderWithNoIdParam(() => db.Device.findByType('light'), (lights) => lights.map(light => new Light(light))),
        thermostats: new DataLoaderWithNoIdParam(() => db.Device.findByType('thermostat'), (thermostats) => thermostats.map(data => new Thermostat(data))),
        usersById: new UnorderedDataLoader((ids) => db.User.findAll({ where: { id: ids }}), ({ id }) => id, user => {
          const userModel = new User(user);

          context.userByHandle.prime(user.handle, userModel);
          return userModel;
        }),
        devicesById: new UnorderedDataLoader((ids) => db.Device.findAll({ where: { id: ids }}), device => device.id, device => Device.create(device)),
        recordingsByEventId: new UnorderedDataLoader((ids) => db.Recording.findAll({ where: { eventId: ids }}), recording => recording.eventId, recording => new Recording(recording))
      };
    }
  });
}