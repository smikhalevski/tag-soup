import {all, char, charBy, seq, substr, untilCharBy, untilSubstr} from '../main/dsl-utils';

const A = 'a'.charCodeAt(0);
const B = 'b'.charCodeAt(0);

describe('char', () => {

  it('reads char at offset', () => {
    expect(char(A)('aaabbb', 2)).toBe(3);
    expect(char(B)('aaabbb', 4)).toBe(5);
  });

  it('does not read unmatched char', () => {
    expect(char(A)('aaabbb', 4)).toBe(-1);
    expect(char(B)('aaabbb', 2)).toBe(-1);
  });
});

describe('charBy', () => {

  it('reads char at offset', () => {
    expect(charBy((c) => c === A)('aaabbb', 2)).toBe(3);
    expect(charBy((c) => c === B)('aaabbb', 4)).toBe(5);
  });

  it('does not read unmatched char', () => {
    expect(charBy((c) => c === A)('aaabbb', 4)).toBe(-1);
    expect(charBy((c) => c === B)('aaabbb', 2)).toBe(-1);
  });
});

describe('substr', () => {

  it('reads case-sensitive substr at offset', () => {
    expect(substr('ab')('aaabbb', 2)).toBe(4);
    expect(substr('AB')('aaabbb', 2)).toBe(-1);
    expect(substr('bb')('aaabbb', 4)).toBe(6);
  });

  it('reads case-insensitive substr at offset', () => {
    expect(substr('AB', true)('aaabbb', 2)).toBe(4);
    expect(substr('BB', true)('aaabbb', 4)).toBe(6);
  });

  it('does not read if substring is not matched', () => {
    expect(substr('aa')('aaabbb', 4)).toBe(-1);
    expect(substr('bb')('aaabbb', 5)).toBe(-1);
  });
});

describe('untilSubstr', () => {

  it('reads chars until substr is met', () => {
    expect(untilSubstr('b', false, false)('aaabbb', 0)).toBe(3);
  });

  it('reads chars until end of string if substr is not met', () => {
    expect(untilSubstr('c', false, true)('aaabbb', 0)).toBe(6);
    expect(untilSubstr('c', true, true)('aaabbb', 0)).toBe(7);
  });

  it('reads chars including substr', () => {
    expect(untilSubstr('b', true, false)('aaabbb', 0)).toBe(4);
  });
});

describe('untilChar', () => {

  it('reads chars until substr is met', () => {
    expect(untilCharBy((c) => c === B, false, false)('aaabbb', 0)).toBe(3);
  });

  it('reads chars until end of string if substr is not met', () => {
    expect(untilCharBy(() => false, false, true)('aaabbb', 0)).toBe(6);
    expect(untilCharBy(() => false, true, true)('aaabbb', 0)).toBe(7);
  });

  it('reads chars including substr', () => {
    expect(untilCharBy((c) => c === B, true, false)('aaabbb', 0)).toBe(4);
  });
});

describe('seq', () => {

  it('invokes takers sequentially', () => {
    const takerMock = jest.fn();
    takerMock.mockReturnValueOnce(4);
    takerMock.mockReturnValueOnce(5);

    expect(seq(takerMock, takerMock)('aabbcc', 2)).toBe(5);
    expect(takerMock).toHaveBeenCalledTimes(2);
  });

  it('fails if any of takers fail', () => {
    const takerMock = jest.fn();
    takerMock.mockReturnValueOnce(4);
    takerMock.mockReturnValueOnce(-1);
    takerMock.mockReturnValueOnce(5);

    expect(seq(takerMock, takerMock, takerMock)('aabbcc', 2)).toBe(-1);
    expect(takerMock).toHaveBeenCalledTimes(2);
  });

  it('allows takers to return the same offset', () => {
    expect(seq(() => 2, () => 4)('aabbcc', 2)).toBe(4);
  });
});

describe('all', () => {

  it('reads chars until taker returns -1', () => {
    const takerMock = jest.fn();
    takerMock.mockReturnValueOnce(3);
    takerMock.mockReturnValueOnce(4);
    takerMock.mockReturnValueOnce(-1);

    expect(all(takerMock)('aabbcc', 2)).toBe(4);
    expect(takerMock).toHaveBeenCalledTimes(3);
  });

  it('reads chars until taker returns the same offset', () => {
    const takerMock = jest.fn();
    takerMock.mockReturnValueOnce(3);
    takerMock.mockReturnValueOnce(3);

    expect(all(takerMock)('aabbcc', 2)).toBe(3);
    expect(takerMock).toHaveBeenCalledTimes(2);
  });
});
