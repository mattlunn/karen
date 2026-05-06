type AwaitedObject<T> = {
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K];
};

export async function awaitPromises<T extends Record<string, unknown>>(obj: T): Promise<AwaitedObject<T>> {
  const entries = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );

  return Object.fromEntries(entries) as AwaitedObject<T>;
}
