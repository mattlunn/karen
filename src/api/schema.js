import { gql } from 'apollo-server-express';

export default gql`
  enum Status {
    HOME,
    AWAY
  }

  enum AlarmMode {
    AWAY,
    NIGHT
  }

  interface Event {
    id: ID!,
    timestamp: Float!
  }

  type Device {
    id: ID!
    name: String!
  }

  type MotionEvent implements Event {
    id: ID!
    timestamp: Float!
    device: Device!
    recording: Recording
  }

  type LightOnEvent implements Event {
    id: ID!
    timestamp: Float!
    device: Device!
  }

  type LightOffEvent implements Event {
    id: ID!
    timestamp: Float!
    device: Device!
    duration: Int!
  }

  type ArrivalEvent implements Event {
    id: ID!
    timestamp: Float!
    user: User!
  }

  type DepartureEvent implements Event {
    id: ID!
    timestamp: Float!
    user: User!
  }

  type Recording {
    id: ID!
  }

  union TimelineEvent = MotionEvent | ArrivalEvent | DepartureEvent | LightOnEvent | LightOffEvent

  type User {
    id: ID!,
    avatar: String!,
    status: Status!,
    since: Float!,
    until: Float
  }

  type Security {
    cameras: [Camera],
    alarmMode: AlarmMode
  }

  type Lighting {
    lights: [Light]
  }

  type Light {
    id: ID!
    name: String!
    isOn: Boolean!
    brightness: Int
  }

  type Camera {
    id: ID!,
    name: String!
    snapshot: String,
  }

  type TimePeriod {
    start: Float!
    end: Float!
  }

  type Aggregate {
    start: Float
    end: Float
    min: Float
    max: Float
    average: Float,
    duration: Float
  }

  type Datum {
    period: TimePeriod
    value: Float
  }

  type History {
    month: [Aggregate],
    day: [Aggregate],
    data: [Datum]
  }

  type Thermostat {
    id: ID!,
    name: String!,
    targetTemperature: Float,
    currentTemperature: Float!,
    isHeating: Boolean!,
    humidity: Float!,
    power: Float!

    heatingHistory(start: Float!, end: Float!): [TimePeriod]
  }

  type Heating {
    thermostats: [Thermostat]
  }

  type Query {
    getUsers: [User]
    getSecurityStatus: Security
    getLighting: Lighting,
    getHeating: Heating,
    getHistory(id: ID!, type: String, from: Float!, to: Float!): History
    getTimeline(since: Float!, limit: Int!): [TimelineEvent!]
  }

  type Mutation {
    updateUser(id: ID!, eta: Float, status: Status): User
    updateLight(id: ID!, isOn: Boolean): Lighting
    updateThermostat(id: ID!, targetTemperature: Float): Thermostat
  }

  type Subscription {
    onLightChanged(id: ID): Light
    onThermostatChanged: Thermostat
  }
`;