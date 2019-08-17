import { ApolloServer } from 'apollo-server-express';
import * as db from '../models';
import { User, Stay, Security, Camera, Lighting, Thermostat, Heating, Light, History } from './models';
import { HOME, AWAY } from '../constants/status';
import moment from 'moment-timezone';
import makeSynologyRequest from '../services/synology/instance'
import DataLoaderWithContextAndNoIdParam from './lib/dataloader-with-context-and-no-id-param';
import DataLoaderWithContext from './lib/dataloader-with-context';
import schema from './schema';

function factoryFromConstructor(Constructor) {
  return (data, context) => new Constructor(data, context);
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
            $gte: args.from,
            lt: args.to
          },
          end: {
            $gte: args.from,
            lt: args.to
          }
        },

        order: ['start']
      });

      console.log(data.length + ' rows to look at');

      return new History(data, args);
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
  }
};

export default new ApolloServer({
  debug: true,
  typeDefs: schema,
  resolvers,
  context: ({ req }) => ({
    req: req,
    userByHandle: new DataLoaderWithContext(factoryFromConstructor(User), (handles) => db.User.findByHandlers(handles)),
    upcomingStayByUserId: new DataLoaderWithContext(factoryFromConstructor(Stay), (id) => db.Stay.findUpcomingStays(id)),
    currentOrLastStayByUserId: new DataLoaderWithContext(factoryFromConstructor(Stay), (id) => db.Stay.findCurrentOrLastStays(id)),
    isHome: new DataLoaderWithContextAndNoIdParam((value) => value, async () => {
      const response = await makeSynologyRequest('SYNO.SurveillanceStation.HomeMode', 'GetInfo');

      return response.data.on;
    }),
    cameras: new DataLoaderWithContextAndNoIdParam((cameras, context) => cameras.map(data => new Camera(data, context)), async () => {
      const response = await makeSynologyRequest('SYNO.SurveillanceStation.Camera', 'List');

      return response.data.cameras;
    }),
    lights: new DataLoaderWithContextAndNoIdParam((lights) => lights.map(light => new Light(light)), () => {
      return db.Device.findByType('light');
    }),
    thermostats: new DataLoaderWithContextAndNoIdParam((thermostats) => thermostats.map(data => new Thermostat(data)), () => {
      return db.Device.findByType('thermostat');
    })
  }),
  formatError(error) {
    console.error(`${error.message}: ${error.extensions.exception.stacktrace.join('\n')}`);

    return error;
  }
});