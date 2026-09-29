import { enqueueWorkItem } from './queue';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe('enqueueWorkItem', () => {
  it('runs items with the same key one at a time, in order', async () => {
    const first = deferred();
    const log: string[] = [];

    const a = enqueueWorkItem(async () => {
      log.push('a start');
      await first.promise;
      log.push('a end');
    }, 'same');
    const b = enqueueWorkItem(async () => {
      log.push('b');
    }, 'same');

    await new Promise((resolve) => setImmediate(resolve));
    expect(log).toEqual(['a start']);

    first.resolve();
    await Promise.all([a, b]);
    expect(log).toEqual(['a start', 'a end', 'b']);
  });

  it('does not hold up items with a different key', async () => {
    const blocker = deferred();
    const blocked = enqueueWorkItem(() => blocker.promise, 'slow');

    await expect(enqueueWorkItem(async () => 'done', 'fast')).resolves.toBe('done');

    blocker.resolve();
    await blocked;
  });

  it('rejects a failed item without stopping the rest of its queue', async () => {
    const failed = enqueueWorkItem(async () => {
      throw new Error('boom');
    }, 'failing');
    const next = enqueueWorkItem(async () => 'next', 'failing');

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('next');
  });

  it('restarts a key after its queue has drained', async () => {
    await enqueueWorkItem(async () => 1, 'drained');

    await expect(enqueueWorkItem(async () => 2, 'drained')).resolves.toBe(2);
  });
});
