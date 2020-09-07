import {createObjectPool} from '../main/createObjectPool';

describe('createObjectPool', () => {

  it('populates pool as new allocations occur', () => {
    let v = 1;

    const pool = createObjectPool(() => v++);

    const v1 = pool.allocate();
    const v2 = pool.allocate();

    expect(pool.size()).toBe(2);

    expect(v1).toBe(1);
    expect(v2).toBe(2);

    expect(pool.cache[0]).toBe(1);
    expect(pool.cache[1]).toBe(2);
  });

  it('reuses existing values after the reset', () => {
    let v = 1;

    const pool = createObjectPool(() => v++);

    pool.allocate();
    pool.allocate();

    pool.reset();

    expect(pool.size()).toBe(0);

    expect(v).toBe(3);

    expect(pool.allocate()).toBe(1);
    expect(pool.allocate()).toBe(2);
    expect(pool.allocate()).toBe(3);
  });
});
