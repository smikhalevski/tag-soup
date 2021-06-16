import {Maybe} from './parser-utils';

export interface IValuePool<T> {

  /**
   * Returns the number of currently allocated values.
   */
  getAllocatedCount(): number;

  /**
   * Returns the next free value from the pool. If there's not free value available then `factory` is called to produce
   * a new value.
   */
  next(): T;

  /**
   * Returns value to the pool so it can be retrieved using {@link next}. If value doesn't belong to the pool or it was
   * already freed then no-op.
   */
  free(value: Maybe<T>): void;
}

export function createValuePool<T extends {}>(factory: () => T, reset?: (value: T) => void, preallocatedCount = 0): IValuePool<T> {
  const cache = new Array<T>(preallocatedCount);
  for (let i = 0; i < preallocatedCount; i++) {
    cache[i] = factory();
  }

  let allocatedCount = 0;

  return {

    getAllocatedCount() {
      return allocatedCount;
    },

    next() {
      return cache[allocatedCount++] ??= factory();
    },

    free(value) {
      for (let i = allocatedCount - 1; i >= 0; i--) {
        if (cache[i] !== value) {
          continue;
        }
        allocatedCount--;
        if (allocatedCount > 0) {
          cache[i] = cache[allocatedCount];
          cache[allocatedCount] = value;
        }
        reset?.(value);
        break;
      }
    },
  };
}
