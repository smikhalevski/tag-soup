import {createFromCharCode, IFromCharCodeOptions} from './createFromCharCode';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {createFromHtmlCharName} from './createFromHtmlCharName';
import {createForgivingSaxParser} from './createForgivingSaxParser';
import {lowerCase, toMap, toSet} from './utils';
import {IForgivingSaxParserOptions, ISaxParser, ISaxParserCallbacks} from './sax-parser-types';

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
  const {
    xhtmlEnabled = false,
  } = options;

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

    isTextContent: (token) => textTags.has(token.name),
    isVoidContent: (token) => voidTags.has(token.name),
    isImplicitEnd: xhtmlEnabled ? undefined : (containerToken, token) => implicitEndMap.get(containerToken.name)?.has(token.name) === true,

    renameTag: lowerCase,
  };

  return createForgivingSaxParser(Object.assign({}, options, saxParserOptions));
}

const voidTags = toSet('area base basefont br col command embed frame hr img input isindex keygen link meta param source track wbr');

const textTags = toSet('script style textarea');

const formTags = toSet('input option optgroup select button datalist textarea');

const pTag = toSet('p');

const implicitEndMap = toMap({
  tr: toSet('tr th td'),
  th: toSet('th'),
  td: toSet('thead th td'),
  body: toSet('head link script'),
  li: toSet('li'),
  option: toSet('option'),
  optgroup: toSet('optgroup option'),
  dd: toSet('dt dd'),
  dt: toSet('dt dd'),
  select: formTags,
  input: formTags,
  output: formTags,
  button: formTags,
  datalist: formTags,
  textarea: formTags,
  p: pTag,
  h1: pTag,
  h2: pTag,
  h3: pTag,
  h4: pTag,
  h5: pTag,
  h6: pTag,
  address: pTag,
  article: pTag,
  aside: pTag,
  blockquote: pTag,
  details: pTag,
  div: pTag,
  dl: pTag,
  fieldset: pTag,
  figcaption: pTag,
  figure: pTag,
  footer: pTag,
  form: pTag,
  header: pTag,
  hr: pTag,
  main: pTag,
  nav: pTag,
  ol: pTag,
  pre: pTag,
  section: pTag,
  table: pTag,
  ul: pTag,
  rt: toSet('rt rp'),
  rp: toSet('rt rp'),
  tbody: toSet('thead tbody'),
  tfoot: toSet('thead tbody'),
});
