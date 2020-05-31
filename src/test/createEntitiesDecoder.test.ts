import {createEntitiesDecoder} from '../main/createEntitiesDecoder';
import {createFromHtmlCharName} from '../main/createFromHtmlCharName';

describe('decode', () => {

  it('decodes decimal entities', () => {
    expect(createEntitiesDecoder()('&#60;')).toBe('<');
  });

  it('decodes hex entities', () => {
    expect(createEntitiesDecoder()('&#x3c;')).toBe('<');
  });

  it('decodes known named entities', () => {
    expect(createEntitiesDecoder()('&lt;')).toBe('<');
  });

  it('decodes all entities in the string', () => {
    expect(createEntitiesDecoder()('&lt;&#34;&gt;')).toBe('<">');
  });

  it('does not require trailing semicolon', () => {
    expect(createEntitiesDecoder({fromCharName: createFromHtmlCharName()})('&ltfoo')).toBe('<foo');
  });
});
