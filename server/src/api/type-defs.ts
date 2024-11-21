import { gql } from 'graphql-tag';

export default gql`
  enum Occupancy {
    HOME
    AWAY
  }

  enum AlarmMode {
    AWAY
    NIGHT
    OFF
  }

  enum CentralHeatingMode {
    ON
    OFF
    SETBACK
  }

  enum DHWHeatingMode {
    ON
    OFF
  }

  enum DeviceStatus {
    OK
    OFFLINE
  }

  interface Event {
    id: ID!
    timestamp: Float!
  }

  interface Device {
    id: ID!
    name: String!
    status: DeviceStatus
  }

  type BasicDevice implements Device {
    id: ID!
    name: String!
    status: DeviceStatus
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

  type AlarmArmingEvent implements Event {
    id: ID!
    timestamp: Float!
    mode: AlarmMode
  }

  type DoorbellRingEvent implements Event {
    id: ID!
    timestamp: Float!
  }

  type Recording {
    id: ID!
  }

  union TimelineEvent = MotionEvent | ArrivalEvent | DepartureEvent | LightOnEvent | LightOffEvent | AlarmArmingEvent | DoorbellRingEvent
  union HistoryDatumType = Thermostat | Light

  type DeviceWrapper {
    type: String!
    device: Device!
  }

  type User {
    id: ID!
    avatar: String!
    status: Occupancy!
    since: Float!
    until: Float
  }

  type Security {
    cameras: [Camera]
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
    status: DeviceStatus
  }

  type Camera implements Device {
    id: ID!
    name: String!
    snapshot: String
    status: DeviceStatus
  }

  type TimePeriod {
    start: Float!
    end: Float!
  }

  type Thermostat implements Device {
    id: ID!
    name: String!
    targetTemperature: Float
    currentTemperature: Float!
    isHeating: Boolean!
    humidity: Float!
    power: Float!
    status: DeviceStatus
  }

  type Heating {
    centralHeatingMode: CentralHeatingMode
    dhwHeatingMode: DHWHeatingMode
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
    getDevice(id: ID!): DeviceWrapper
    getDevices: [DeviceWrapper]
    getUsers: [User]
    getSecurityStatus: Security
    getLighting: Lighting,
    getHeating: Heating,
    getHistory(ids: [ID!], type: String, from: Float!, to: Float!, interval: Float!): History
    getTimeline(since: Float!, limit: Int!): [TimelineEvent!]
  }

  type Mutation {
    updateUser(id: ID!, eta: Float, status: Occupancy): User
    updateLight(id: ID!, isOn: Boolean, brightness: Int): Light
    updateThermostat(id: ID!, targetTemperature: Float): Thermostat
    updateAlarm(mode: AlarmMode): Security
    updateCentralHeatingMode(mode: CentralHeatingMode): Heating
    updateDHWHeatingMode(mode: DHWHeatingMode): Heating
  }

  type Subscription {
    onLightChanged(id: ID): Light
    onThermostatChanged: Thermostat
  }
`;