import { gql } from 'graphql-tag';

export const main = gql`
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

  type Device {
    id: ID!
    name: String!
    status: DeviceStatus
    room: Room

    capabilities: [Capability]
  }

  union Capability = MotionSensor | TemperatureSensor | LightSensor | Light | Thermostat | Camera | HumiditySensor | Speaker | Switch | HeatPump | Lock | BatteryLevelIndicator | BatteryLowIndicator

  type Lock {
    isLocked: Boolean!
  }

  type BatteryLevelIndicator {
    batteryPercentage: Boolean!
  }

  type BatteryLowIndicator {
    isLow: Boolean!
  }

  type MotionSensor {
    motionDetected: Boolean!
  }

  type MotionSensor {
    motionDetected: Boolean!
  }
  

  type TemperatureSensor {
    currentTemperature: Float!
  }

  type Switch {
    isOn: Boolean!
  }

  type LightSensor {
    illuminance: Float!
  }

  type Light {
    isOn: Boolean!
    brightness: Int
  }

  type Camera {
    snapshot: String
  }

  type HumiditySensor {
    humidity: Float!
  }

  type Speaker {
    randomPropertyAsGraphQlDoesNotAllowTypesWithNoProperties: Int
  }

  type Thermostat {
    targetTemperature: Float!
    currentTemperature: Float!
    isHeating: Boolean!
    power: Float!
  }

  type HeatPump {
    compressorModulation: Float!
    dailyConsumedEnergy: Float!
    dhwTemperature: Float!
    heatingCoP: Float!
    mode: String!
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

  enum EventType {
    USER_ARRIVAL
    USER_DEPARTURE
    ALARM_ARMING
    DOORBELL_RING
  }

  type User {
    id: ID!
    avatar: String!
    status: Occupancy!
    since: Float!
    until: Float
  }

  type Security {
    cameras: [Device]
    alarmMode: AlarmMode
  }

  type Lighting {
    lights: [Device]
  }

  type TimePeriod {
    start: Float!
    end: Float!
  }

  type Heating {
    centralHeatingMode: CentralHeatingMode
    dhwHeatingMode: DHWHeatingMode
    thermostats: [Device]
  }

  type History {
    data: [HistoryDatum!]
  }

  type HistoryDatum {
    period: TimePeriod!
    datum: HistoryDatumType!
  }

  type Room {
    id: ID!
    name: String!
    displayIconName: String
    displayWeight: String
    devices: [Device]
  }

  type Query {
    getDevice(id: ID!): Device
    getDevices: [Device]
    getUsers: [User]
    getSecurityStatus: Security
    getTimeline(since: Float!, limit: Int!): [TimelineEvent!]
    getHistory(since: Float!, limit: Int!, devices: [ID!], events: [EventType!]): [Event!]
    getRooms: [Room]
  }

  type Mutation {
    updateUser(id: ID!, eta: Float, status: Occupancy): User
    updateLight(id: ID!, isOn: Boolean, brightness: Int): Device
    updateLock(id: ID!, isLocked: Boolean): Device
    updateThermostat(id: ID!, targetTemperature: Float): Device
    updateAlarm(mode: AlarmMode): Security
    updateCentralHeatingMode(mode: CentralHeatingMode): Heating
    updateDHWHeatingMode(mode: DHWHeatingMode): Heating
  }

  type Subscription {
    onDeviceChanged: Device
  }
`;

export { capabilities } from './capabilities.gen';