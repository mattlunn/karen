import setIntervalForTime from './set-interval-for-time';

export default function nowAndSetIntervalForTime(func, time) {
  func();
  setIntervalForTime(func, time);
}
