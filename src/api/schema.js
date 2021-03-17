import { gql } from 'apollo-server-express';

export default gql`
  enum Status {
    HOME,
    AWAY
  }

  enum AlarmMode {
    AWAY,
    NIGHT,
    OFF
  }

  interface Event {
    id: ID!,
    timestamp: Float!
  }

  interface Device {
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
  union HistoryDatumType = Thermostat | Light

  type DeviceWrapper {
    type: String!,
    device: Device!
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
    alarmMode: AlarmMode
  }

  type Lighting {
    lights: [Light]
  }

  type Light implements Device {
    id: ID!
    name: String!
    isOn: Boolean!
    brightness: Int
  }

  type Camera implements Device {
    id: ID!,
    name: String!
    snapshot: String,
  }

  type TimePeriod {
    start: Float!
    end: Float!
  }

  type Thermostat implements Device {
    id: ID!,
    name: String!,
    targetTemperature: Float,
    currentTemperature: Float!,
    isHeating: Boolean!,
    humidity: Float!,
    power: Float!
  }

  type Heating {
    thermostats: [Thermostat]
  }

  type History {
    data: [HistoryDatum!]
  }

  type HistoryDatum {
    period: TimePeriod!
    datum: HistoryDatumType!
  }

  type Query {
    getDevice(id: ID!): DeviceWrapper,
    getUsers: [User]
    getSecurityStatus: Security
    getLighting: Lighting,
    getHeating: Heating,
    getHistory(ids: [ID!], type: String, from: Float!, to: Float!, interval: Float!): History
    getTimeline(since: Float!, limit: Int!): [TimelineEvent!]
  }

  type Mutation {
    updateUser(id: ID!, eta: Float, status: Status): User
    updateLight(id: ID!, isOn: Boolean, brightness: Int): Lighting
    updateThermostat(id: ID!, targetTemperature: Float): Thermostat
  }

  type Subscription {
    onLightChanged(id: ID): Light
    onThermostatChanged: Thermostat
  }
`;