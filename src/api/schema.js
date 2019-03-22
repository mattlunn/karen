import { gql } from 'apollo-server-express';

export default gql`
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

  type Security {
    cameras: [Camera],
    isHome: Boolean
  }

  type Camera {
    id: ID!,
    snapshot: String,
    name: String
  }

  type Query {
    getUsers: [User]
    getSecurityStatus: Security
  }

  type Mutation {
    updateUser(id: ID!, eta: Float, status: Status): User
  }
`