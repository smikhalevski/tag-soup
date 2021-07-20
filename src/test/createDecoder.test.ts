import {createDecoder} from '../main/createDecoder';
import {createFromHtmlCharName} from '../main/createFromHtmlCharName';
import {fromXmlEntityName} from '../main/xml-decoder';

describe('createDecoder', () => {

  it('decodes decimal entities', () => {
    expect(createDecoder(fromXmlEntityName)('&#60;')).toBe('<');
  });

  it('decodes hex entities', () => {
    expect(createDecoder(fromXmlEntityName)('&#x3c;')).toBe('<');
  });

  it('decodes known named entities', () => {
    expect(createDecoder(fromXmlEntityName)('&lt;')).toBe('<');
  });

  it('decodes all entities in the string', () => {
    expect(createDecoder(fromXmlEntityName)('&lt;&#34;&gt;')).toBe('<">');
  });

  it('does not require trailing semicolon', () => {
    expect(createDecoder(createFromHtmlCharName())('&ltfoo')).toBe('<foo');
  });
});
