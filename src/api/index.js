import { gql, ApolloServer } from 'apollo-server-express';
import * as db from '../models';
import { User, Stay } from './models';
import { HOME, AWAY } from '../constants/status';
import DataLoader from 'dataloader';
import moment from 'moment-timezone';

class DataLoaderWithContext {
  constructor(Constructor, loader) {
    this.Constructor = Constructor;
    this.loader = new DataLoader(loader);
  }

  async load(id, context) {
    const result = await this.loader.load(id);

    return result === null ? result : new this.Constructor(result, context);
  }

  async loadMany(ids, context) {
    const results = await this.loader.loadMany(ids);

    return results.map(result => new this.Constructor(result, context));
  }

  prime(id, value) {
    this.loader.prime(id, value);
  }
}

const schema = gql`
  enum Status {
    HOME,
    AWAY
  }

  type User {
    id: ID!,
    avatar: String!,
    status: Status!,
    since: Float!,
    until: Float
  }

  type Query {
    getUsers: [User]
  }

  type Mutation {
    updateUser(id: ID!, eta: Float, status: Status): User
  }
`;

const resolvers = {
  Query: {
    async getUsers(parent, args, context, info) {
      const users = await db.User.findAll();

      return users.map(user => new User(user, context));
    }
  },

  Mutation: {
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
    userByHandle: new DataLoaderWithContext(User, (handles) => db.User.findByHandlers(handles)),
    upcomingStayByUserId: new DataLoaderWithContext(Stay, (id) => db.Stay.findUpcomingStays(id)),
    currentOrLastStayByUserId: new DataLoaderWithContext(Stay, (id) => db.Stay.findCurrentOrLastStays(id))
  })
});