import {createFromCharCode, IFromCharCodeOptions} from './createFromCharCode';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {createFromHtmlCharName} from './createFromHtmlCharName';
import {createForgivingSaxParser} from './createForgivingSaxParser';
import {lowerCase} from './utils';
import {IForgivingSaxParserOptions, ISaxParser, ISaxParserCallbacks} from './sax-parser-types';
import {isHtmlImplicitEnd, isHtmlTextContent, isHtmlVoidContent} from './html-utils';

export interface IHtmlSaxParserDialectOptions extends IFromCharCodeOptions {

  /**
   * If set to `true` then:
   * - Self-closing tags are parsed;
   * - All non-void elements are expected to be closed.
   *
   * @default false
   */
  xhtmlEnabled?: boolean;

  /**
   * If set to `true` then:
   * - Doesn't recognize non-terminated and legacy HTML entities;
   * - Throw an error if the decoder meets a disallowed character reference.
   *
   * **Note:** Using this option may slow parsing because additional checks are involved.
   *
   * @default false
   */
  strict?: boolean;
}

export interface IHtmlSaxParserOptions extends IHtmlSaxParserDialectOptions, ISaxParserCallbacks {
}

/**
 * Creates preconfigured HTML SAX parser.
 */
export function createHtmlSaxParser(options: IHtmlSaxParserOptions): ISaxParser {
  const {xhtmlEnabled = false} = options;

  const fromCharCode = createFromCharCode(options);

  const htmlAttrDecoder = createEntitiesDecoder({
    fromCharName: createFromHtmlCharName(options),
    fromCharCode,
  });

  const htmlTextDecoder = createEntitiesDecoder({
    fromCharName: createFromHtmlCharName(),
    fromCharCode,
  });

  const saxParserOptions: IForgivingSaxParserOptions = {
    xmlEnabled: false,
    selfClosingEnabled: xhtmlEnabled,
    decodeAttr: htmlAttrDecoder,
    decodeText: htmlTextDecoder,

    isTextContent: isHtmlTextContent,
    isVoidContent: isHtmlVoidContent,
    isImplicitEnd: xhtmlEnabled ? undefined : isHtmlImplicitEnd,

    renameTag: lowerCase,
  };

  return createForgivingSaxParser(Object.assign({}, options, saxParserOptions));
}
