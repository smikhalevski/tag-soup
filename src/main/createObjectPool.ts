import {IArrayLike} from './parser-types';

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
 * The blazing fast object pool implementation. Inspired by {@link https://github.com/getify/deePool deePool}.
 *
 * @param factory The factory that produces new values.
 * @param reset The callback that is invoked when value is returned to the pool via {@link free}.
 */
export function createObjectPool<T>(factory: () => T, reset?: (value: T) => void): IObjectPool<T> {
  const cachedValues: IArrayLike<T> = {length: 0};

  let takenCount = 0;

  const take = (): T => {
    if (takenCount === cachedValues.length) {
      allocate();
    }
    const value = cachedValues[takenCount];
    cachedValues[takenCount++] = undefined as unknown as T;
    return value;
  };

  const free = (value: T): void => {
    reset?.(value);
    cachedValues[takenCount === 0 ? cachedValues.length : --takenCount] = value;
  };

  const allocate = (count = cachedValues.length + 1): void => {
    count |= 0;
    if (count <= 0) {
      return;
    }
    const prevLength = cachedValues.length;
    const nextLength = cachedValues.length += count;

    for (let i = prevLength; i < nextLength; i++) {
      cachedValues[i] = factory();
    }
  };

  return {take, free, allocate};
}
