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

  type Lighting {
    lights: [Light]
  }

  type Light {
    id: ID!
    name: String!
    isOn: Boolean!
  }

  type Camera {
    id: ID!,
    snapshot: String,
    name: String
  }

  type TimePeriod {
    start: Float!
    end: Float!
  }

  type Thermostat {
    id: ID!,
    name: String,
    targetTemperature: Float,
    currentTemperature: Float!,
    isHeating: Boolean!,
    humidity: Float!,
    eta: Float,
    isHome: Boolean!,

    heatingHistory(start: Float!, end: Float!): [TimePeriod]
  }

  type Heating {
    thermostats: [Thermostat]
  }

  type Query {
    getUsers: [User]
    getSecurityStatus: Security
    getLighting: Lighting,
    getHeating: Heating
  }

  type Mutation {
    updateUser(id: ID!, eta: Float, status: Status): User
    updateLight(id: ID!, isOn: Boolean): Lighting
    updateThermostat(id: ID!, targetTemperature: Float): Thermostat
  }
`