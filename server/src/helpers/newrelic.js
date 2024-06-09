import newrelic from 'newrelic';

export function startBackgroundTransaction(name, cb) {
  return newrelic.startBackgroundTransaction(name, async () => {
    try {
      return await cb();
    } catch (e) {
      newrelic.noticeError(e);

      throw e;
    }
  });
}

export function createBackgroundTransaction(name, cb) {
  return (...args) => newrelic.startBackgroundTransaction(name, async () => {
    try {
      return await cb(...args);
    } catch (e) {
      newrelic.noticeError(e);

      throw e;
    }
  });
}