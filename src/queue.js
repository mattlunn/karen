const queue = [];

async function processQueue() {
  while (queue.length) {
    try {
      await queue[0]();
    } finally {
      queue.shift();
    }
  }
}

export function enqueueWorkItem(item) {
  return new Promise((res, rej) => {
    queue.push(() => item().then(res, rej));

    if (queue.length === 1) {
      processQueue();
    }
  });
}