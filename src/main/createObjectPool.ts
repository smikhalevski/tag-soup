export interface ObjectPool<T> {

  /**
   * Returns the list of all allocated values.
   */
  getAll(): ArrayLike<T>;

  detachAll(): Array<T>;

  /**
   * Returns the cached value or creates a new value using factory.
   */
  allocate(): T;

  /**
   * Returns value back to the pool.
   *
   * @returns `true` if value was returned to the pool, `false` is value was not allocated by this pool.
   */
  free(value: T): boolean;

  /**
   * Returns all allocated values to the pool.
   */
  freeAll(): void;
}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Creates an object pool that caches instances produced by `objectFactory`.
 *
 * @param objectFactory The factory that creates new instances on demand.
 * @param resetValue The callback that is invoked when value is returned to the pool using `free` of `freeAll`.
 */
export function createObjectPool<T>(objectFactory: () => T, resetValue?: (value: T) => void): ObjectPool<T> {
  const free = new Array<T>(50);
  const used: Mutable<ArrayLike<T>> = {length: 0};

  let freeCount = 0;
  let usedCount = 0;

  return {

    getAll() {
      return used;
    },

    detachAll() {
      usedCount = 0;
      return Array.from(used);
    },

    allocate() {
      if (freeCount === 0) {
        const value = used[usedCount++] = objectFactory();
        used.length = usedCount;
        return value;
      }
      const value = used[usedCount++] = free[0];
      free[0] = free[--freeCount];
      used.length = usedCount;
      return value;
    },

    free(value) {
      let i = -1;
      for (let j = 0; j < usedCount; j++) {
        if (used[j] === value) {
          i = j;
          break;
        }
      }
      if (i === -1) {
        return false;
      }
      resetValue?.(value);
      used[i] = used[--usedCount];
      used.length = usedCount;
      free[freeCount++] = value;
      return true;
    },

    freeAll() {
      for (let i = 0; i < usedCount; i++) {
        const value = used[i];
        resetValue?.(value);
        free[freeCount + i] = value;
      }
      freeCount += usedCount;
      used.length = usedCount = 0;
    },
  };
}
