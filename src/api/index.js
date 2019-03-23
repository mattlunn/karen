import { ApolloServer } from 'apollo-server-express';
import * as db from '../models';
import { User, Stay, Security, Camera, Lighting, lightFactory } from './models';
import { HOME, AWAY } from '../constants/status';
import moment from 'moment-timezone';
import makeSynologyRequest from '../services/synology/instance'
import DataLoaderWithContextAndNoIdParam from './lib/dataloader-with-context-and-no-id-param';
import DataLoaderWithContext from './lib/dataloader-with-context';
import schema from './schema';
import { getLightsAndStatus as getLightsAndStatusFromLightwave, setLightFeatureValue as setLightwaveLightFeatureValue } from '../services/lightwaverf';
import { getLightsAndStatus as getLightsAndStatusFromTpLink, turnLightOnOrOff as turnTpLinkLightOnOrOff } from '../services/tplink';

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
    }
  },

  Mutation: {
    async updateLight(parent, args, context, info) {
      const lights = await Promise.all([
        getLightsAndStatusFromLightwave(),
        getLightsAndStatusFromTpLink()
      ]);

      const light = lights.flat().find(x => x.id === args.id);

      if (light) {
        switch (light.provider) {
          case 'lightwaverf':
            await setLightwaveLightFeatureValue(light.switchFeatureId, +args.isOn);
            break;
          case 'tplink':
            await turnTpLinkLightOnOrOff(args.id, args.isOn);
            break;
          default:
            throw new Error(`${light.provider} is not a recognised provider`);
        }
      } else {
        throw new Error(`${args.id} is not a recognised light id`);
      }

      return new Lighting(context);
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
        upcoming.etaSentToNestAt = null;

        await upcoming.save();
      }

      context.upcomingStayByUserId.prime(user.id, upcoming);
      context.currentOrLastStayByUserId.prime(user.id, current);

      return new User(user, context);
    }
  }
};

export default new ApolloServer({
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
    lights: new DataLoaderWithContextAndNoIdParam(lightFactory, async () => {
      const lights = await Promise.all([
        getLightsAndStatusFromLightwave(),
        getLightsAndStatusFromTpLink()
      ]);

      return lights.flat();
    }),
  })
});