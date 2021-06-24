export interface IObjectPool<T> {

  /**
   * Returns the next value from the pool. If there's not free value available then `factory` is called to produce a
   * new value.
   */
  take(): T;

  /**
   * Returns value to the pool so it can be retrieved using {@link take}. If value doesn't belong to the pool or it was
   * already freed then no-op.
   */
  free(value: T): void;

  /**
   * Populates pool with `count` number of new values produced by `factory`.
   */
  allocate(count: number): void;
}

/**
 * The value pool that streamlines value reuse.
 *
 * @param factory The factory that produces new values.
 * @param reset The callback that is invoked when value is returned to the pool via {@link free}.
 * @see https://github.com/getify/deePool
 */
export function createObjectPool<T>(factory: () => T, reset?: (value: T) => void): IObjectPool<T> {
  const cache: Array<T> = [];

  let takenCount = 0;

  const take = (): T => {
    if (takenCount === cache.length) {
      allocate();
    }
    const value = cache[takenCount];
    cache[takenCount++] = null as unknown as T;
    return value;
  };

  const free = (value: T): void => {
    reset?.(value);
    cache[takenCount === 0 ? cache.length : --takenCount] = value;
  };

  const allocate = (count = cache.length + 1): void => {
    count |= 0;
    if (count <= 0) {
      return;
    }
    const prevLength = cache.length;
    const nextLength = cache.length += count;

    for (let i = prevLength; i < nextLength; i++) {
      cache[i] = factory();
    }
  };

  return {take, free, allocate};
}
