import {createSaxParser, SaxParser, SaxParserOptions} from './createSaxParser';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {createFromHtmlCharName} from './createFromHtmlCharName';
import {createFromCharCode} from './createFromCharCode';

export function createHtmlSaxParser(options: SaxParserOptions): SaxParser {
  const fromCharCode = createFromCharCode();
  const saxParserOptions: SaxParserOptions = {

    decodeAttr: createEntitiesDecoder({
      fromCharName: createFromHtmlCharName({strict: true}),
      fromCharCode,
    }),

    decodeText: createEntitiesDecoder({
      fromCharName: createFromHtmlCharName(),
      fromCharCode,
    }),

    isRawTag(tagName) {
      const name = tagName.toLowerCase();
      return name === 'script' || name === 'style' || name === 'textarea';
    },
    xmlEnabled: false,
    selfClosingEnabled: false,
  };
  return createSaxParser(Object.assign(saxParserOptions, options));
}
