export interface ObjectPool<T> {

  cache: Array<T>;

  /**
   * Returns the cached value or creates a new value using factory.
   */
  allocate(): T;

  /**
   * Returns all allocated values to the pool.
   */
  reset(): void;

  /**
   * Returns the number of allocations since the last reset.
   */
  size(): number;
}

export function createObjectPool<T>(objectFactory: () => T): ObjectPool<T> {
  let cache: Array<T> = [];
  let count = 0;

  return {
    cache,

    allocate() {
      return cache[count] = cache[count++] || objectFactory();
    },
    reset() {
      count = 0;
    },
    size() {
      return count;
    },
  };
}
