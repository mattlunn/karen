import { faDoorClosed } from '@fortawesome/free-solid-svg-icons';
import { CapabilityUIConfig } from '../types';
import Lock from '../../devices/lock';

export const lockConfig: CapabilityUIConfig<'LOCK'> = {
  type: 'LOCK',
  icon: faDoorClosed,
  iconPriority: 25,

  getStatusItems: () => [],

  GroupControl: Lock,
};
