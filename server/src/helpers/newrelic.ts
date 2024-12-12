import newrelic from 'newrelic';
import logger from '../logger';

export function startBackgroundTransaction<T>(name: string, cb: () => Promise<T>) {
  return newrelic.startBackgroundTransaction(name, async () => {
    try {
      return await cb();
    } catch (e) {
      newrelic.noticeError(e as Error);

      throw e;
    }
  });
}

export function createBackgroundTransaction<T>(name: string, cb: (...args: any[]) => Promise<T>) {
  return (...args: any[]) => newrelic.startBackgroundTransaction(name, async () => {
    try {
      return await cb(...args);
    } catch (e) {
      newrelic.noticeError(e as Error);
      logger.error(e);

      throw e;
    }
  });
}