import {createDecoder} from '../main/createDecoder';
import {createFromHtmlCharName} from '../main/createFromHtmlCharName';

describe('createDecoder', () => {

  it('decodes decimal entities', () => {
    expect(createDecoder()('&#60;')).toBe('<');
  });

  it('decodes hex entities', () => {
    expect(createDecoder()('&#x3c;')).toBe('<');
  });

  it('decodes known named entities', () => {
    expect(createDecoder()('&lt;')).toBe('<');
  });

  it('decodes all entities in the string', () => {
    expect(createDecoder()('&lt;&#34;&gt;')).toBe('<">');
  });

  it('does not require trailing semicolon', () => {
    expect(createDecoder(createFromHtmlCharName())('&ltfoo')).toBe('<foo');
  });
});
