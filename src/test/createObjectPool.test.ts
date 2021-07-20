import {createObjectPool} from '../main/createObjectPool';

describe('createObjectPool', () => {

  test('returns new value', () => {
    let i = 0;
    const pool = createObjectPool(() => i++);

    expect(pool.take()).toBe(0);
    expect(pool.take()).toBe(1);
    expect(pool.take()).toBe(2);
  });

  test('frees a single value', () => {
    let i = 0;
    const pool = createObjectPool(() => i++);

    expect(pool.take()).toBe(0);
    pool.release(0);
    expect(pool.take()).toBe(0);
  });

  test('frees existing value', () => {
    let i = 0;
    const pool = createObjectPool(() => i++);

    expect(pool.take()).toBe(0);
    expect(pool.take()).toBe(1);
    expect(pool.take()).toBe(2);

    pool.release(1);

    expect(pool.take()).toBe(1);
  });

  test('frees multiple existing values', () => {
    let i = 0;
    const pool = createObjectPool(() => i++);

    expect(pool.take()).toBe(0);
    expect(pool.take()).toBe(1);
    expect(pool.take()).toBe(2);

    pool.release(0);
    pool.release(2);

    expect(pool.take()).toBe(2);
    expect(pool.take()).toBe(0);
  });
});
