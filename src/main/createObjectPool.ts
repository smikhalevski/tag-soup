export interface ObjectPool<T> {

  cache: Array<T>;

  /**
   * Returns the cached value or allocates a new value.
   */
  allocate(): T;

  /**
   * Returns all allocated value to the pool.
   */
  reset(): void;

  /**
   * Returns the number of allocations since the last reset.
   */
  countAllocations(): number;
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
    countAllocations() {
      return count;
    },
  };
}
