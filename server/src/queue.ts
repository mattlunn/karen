const queues = new Map<string, (() => Promise<void>)[]>();

async function processQueue(queue: (() => Promise<void>)[], key: string): Promise<void> {
  while (queue.length) {
    try {
      await queue[0]();
    } catch(e) {
      // Intentionally empty
    } finally {
      queue.shift();
    }
  }

  queues.delete(key);
}

export function enqueueWorkItem<T>(item: () => Promise<T>, key = 'default'): Promise<T> {
  return new Promise((res, rej) => {
    const queue = queues.get(key) ?? [];

    queues.set(key, queue);
    queue.push(() => item().then(res, rej));

    if (queue.length === 1) {
      processQueue(queue, key);
    }
  });
}
