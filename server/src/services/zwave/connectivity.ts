import dayjs from '../../dayjs';

// zwave-js NodeStatus: 0=Unknown, 1=Asleep, 2=Awake, 3=Dead, 4=Alive.
const ZWAVE_NODE_STATUS_DEAD = 3;
const WAKE_UP_COMMAND_CLASS = 132;
const PING_AFTER_QUIET_HOURS = 4;
const WAKE_UP_INTERVALS_BEFORE_DISCONNECTED = 2;

export type ZWaveNodeConnectivityState = {
  status: number;
  isListening: boolean;
  isFrequentListening: false | string;
  statistics?: { lastSeen?: string };
  values?: { commandClass: number; property: string | number; value?: unknown }[];
};

export type ConnectivityCheck = 'connected' | 'disconnected' | 'ping' | 'unknowable';

export function checkConnectivity(node: ZWaveNodeConnectivityState, now: Date): ConnectivityCheck {
  if (node.status === ZWAVE_NODE_STATUS_DEAD) {
    return 'disconnected';
  }

  const lastSeen = node.statistics?.lastSeen ?? null;

  // zwave-js only marks a node Dead when a message to it fails, so a quiet node has to be sent one.
  if (node.isListening || node.isFrequentListening) {
    return lastSeen !== null && dayjs(now).diff(lastSeen, 'hour', true) < PING_AFTER_QUIET_HOURS ? 'connected' : 'ping';
  }

  // A sleeping node can't be pinged; the ping just waits for its next wake-up.
  const wakeUpIntervalSeconds = node.values?.find((value) => value.commandClass === WAKE_UP_COMMAND_CLASS && value.property === 'wakeUpInterval')?.value;

  if (typeof wakeUpIntervalSeconds !== 'number' || wakeUpIntervalSeconds === 0) {
    return 'unknowable';
  }

  return lastSeen !== null && dayjs(now).diff(lastSeen, 'second', true) <= wakeUpIntervalSeconds * WAKE_UP_INTERVALS_BEFORE_DISCONNECTED ? 'connected' : 'disconnected';
}
