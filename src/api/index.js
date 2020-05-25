import { ApolloServer } from 'apollo-server-express';
import * as db from '../models';
import { User, Stay, Security, Camera, Lighting, Thermostat, Heating, Light, History, MotionEvent, ArrivalEvent, DepartureEvent, LightOnEvent, LightOffEvent, Device, Recording } from './models';
import { HOME, AWAY } from '../constants/status';
import moment from 'moment-timezone';
import makeSynologyRequest from '../services/synology/instance';
import UnorderedDataLoader from './lib/unordered-dataloader';
import DataLoaderWithNoIdParam from './lib/dataloader-with-no-id-param';
import schema from './schema';
import bus, { DEVICE_PROPERTY_CHANGED } from '../bus';

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
      const data = await db.Event.findAll({
        where: {
          deviceId: args.id,
          type: args.type,
          start: {
            [db.Op.gte]: args.from,
            [db.Op.lt]: args.to
          },
          end: {
            [db.Op.gte]: args.from,
            [db.Op.lt]: args.to
          }
        },

        order: ['start']
      });

      return new History(data, args);
    },

    async getTimeline(parent, { since, limit }, context, info) {
      const events = await Promise.all([
        db.Event.findAll({
          order: [['start', 'DESC']],
          where: {
            start: {
              [db.Op.lt]: since
            },
            type: 'motion'
          },
          limit
        }).then((events) => events.map((event) => new MotionEvent(event))),

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

        db.Event.findAll({
          order: [['start', 'DESC']],
          where: {
            start: {
              [db.Op.lt]: since
            },
            type: 'on'
          },
          limit
        }).then((events) => {
          return events.map((event) => {
            const ret = [new LightOnEvent(event)];

            if (event.end) {
              ret.push(new LightOffEvent(event));
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

      await light.setProperty('on', args.isOn);
      return new Lighting(context);
    },

    async updateThermostat(parent, args, context, info) {
      const thermostat = await db.Device.findById(args.id);
      await thermostat.setProperty('target', args.targetTemperature);

      return new Thermostat(thermostat);
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

  Subscription: {
    onThermostatChanged: createSubscriptionForDeviceType('thermostat', device => ({ onThermostatChanged: new Thermostat(device) })),
    onLightChanged: createSubscriptionForDeviceType('light', device => ({ onLightChanged: new Light(device) }), ['on', 'brightness'])
  }
};

export default new ApolloServer({
  debug: true,
  typeDefs: schema,
  resolvers,
  context: ({ req }) => {
    const context = {
      req: req,
      userByHandle: new UnorderedDataLoader(db.User.findByHandles.bind(db.User), ({ handle }) => handle, user => new User(user)),
      upcomingStayByUserId: new UnorderedDataLoader(db.Stay.findUpcomingStays.bind(db.Stay), ({ userId }) => userId, stay => new Stay(stay)),
      currentOrLastStayByUserId: new UnorderedDataLoader(db.Stay.findCurrentOrLastStays.bind(db.Stay), ({ userId }) => userId, stay => new Stay(stay)),
      isHome: new DataLoaderWithNoIdParam(async () => {
        const response = await makeSynologyRequest('SYNO.SurveillanceStation.HomeMode', 'GetInfo');

        return response.data.on;
      }, (value) => value),
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
      devicesById: new UnorderedDataLoader((ids) => db.Device.findAll({ where: { id: ids }}), device => device.id, device => new Device(device)),
      recordingsByEventId: new UnorderedDataLoader((ids) => db.Recording.findAll({ where: { eventId: ids }}), recording => recording.eventId, recording => new Recording(recording))
    };

    return context;
  },
  formatError(error) {
    console.error(`${error.message}: ${error.extensions.exception.stacktrace.join('\n')}`);

    return error;
  }
});