import { gql, ApolloServer } from 'apollo-server-express';
import * as db from '../models';
import { User, Stay } from './models';
import DataLoader from 'dataloader';

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
}

const schema = gql`
  enum Status {
    HOME,
    AWAY
  }

  type User {
    handle: String!,
    id: ID!,
    avatar: String!,
    status: Status!,
    since: Float!,
    until: Float
  }

  type Query {
    getUsers: [User]
  }
`;

const resolvers = {
  Query: {
    async getUsers(parent, args, context, info) {
      const users = await db.User.findAll();

      return users.map(user => new User(user, context));
    }
  }
};

export default new ApolloServer({
  typeDefs: schema,
  resolvers,
  context: ({ req }) => ({
    upcomingStayByUserId: new DataLoaderWithContext(Stay, (id) => db.Stay.findUpcomingStays(id)),
    currentOrLastStayByUserId: new DataLoaderWithContext(Stay, (id) => db.Stay.findCurrentOrLastStays(id))
  })
});