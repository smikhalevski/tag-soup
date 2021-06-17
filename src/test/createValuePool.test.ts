import {createValuePool} from '../main/createValuePool';

describe('createValuePool', () => {

  test('returns new value', () => {
    let i = 0;
    const pool = createValuePool(() => i++);

    expect(pool.next()).toBe(0);
    expect(pool.next()).toBe(1);
    expect(pool.next()).toBe(2);
  });

  test('frees a single value', () => {
    let i = 0;
    const pool = createValuePool(() => i++);

    expect(pool.next()).toBe(0);
    pool.free(0);
    expect(pool.next()).toBe(0);
  });

  test('frees existing value', () => {
    let i = 0;
    const pool = createValuePool(() => i++);

    expect(pool.next()).toBe(0);
    expect(pool.next()).toBe(1);
    expect(pool.next()).toBe(2);

    pool.free(1);

    expect(pool.next()).toBe(1);
  });

  test('frees multiple existing values', () => {
    let i = 0;
    const pool = createValuePool(() => i++);

    expect(pool.next()).toBe(0);
    expect(pool.next()).toBe(1);
    expect(pool.next()).toBe(2);

    pool.free(0);
    pool.free(2);

    expect(pool.next()).toBe(2);
    expect(pool.next()).toBe(0);
  });
});
