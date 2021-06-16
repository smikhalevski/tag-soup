import {createFromCharCode, IFromCharCodeOptions} from './createFromCharCode';
import {ISaxParser, ISaxParserCallbacks} from './createSaxParser';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {createFromHtmlCharName} from './createFromHtmlCharName';
import {createForgivingSaxParser, IForgivingSaxParserOptions} from './createForgivingSaxParser';
import {clearPrototype} from './parser-utils';
import {lowerCase} from './tokenize';

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

    isTextContent: (token) => textTagMap[token.tagName] === 1,
    isVoidContent: (token) => voidTagMap[token.tagName] === 1,
    isImplicitEnd: xhtmlEnabled ? undefined : (containerTagName, token) => implicitEndMap[containerTagName]?.[token.tagName] === 1,

    renameTag: lowerCase,
  };

  return createForgivingSaxParser(Object.assign({}, options, saxParserOptions));
}

const voidTagMap = clearPrototype<Record<string, 1>>({
  area: 1,
  base: 1,
  basefont: 1,
  br: 1,
  col: 1,
  command: 1,
  embed: 1,
  frame: 1,
  hr: 1,
  img: 1,
  input: 1,
  isindex: 1,
  keygen: 1,
  link: 1,
  meta: 1,
  param: 1,
  source: 1,
  track: 1,
  wbr: 1,
});

const textTagMap = clearPrototype<Record<string, 1>>({
  script: 1,
  style: 1,
  textarea: 1,
});

const formTagMap = clearPrototype<Record<string, 1>>({
  input: 1,
  option: 1,
  optgroup: 1,
  select: 1,
  button: 1,
  datalist: 1,
  textarea: 1,
});

const pTagMap = clearPrototype<Record<string, 1>>({p: 1});

const implicitEndMap = clearPrototype<Record<string, Record<string, 1>>>({
  tr: clearPrototype({tr: 1, th: 1, td: 1}),
  th: clearPrototype({th: 1}),
  td: clearPrototype({thead: 1, th: 1, td: 1}),
  body: clearPrototype({head: 1, link: 1, script: 1}),
  li: clearPrototype({li: 1}),
  option: clearPrototype({option: 1}),
  optgroup: clearPrototype({optgroup: 1, option: 1}),
  dd: clearPrototype({dt: 1, dd: 1}),
  dt: clearPrototype({dt: 1, dd: 1}),
  select: formTagMap,
  input: formTagMap,
  output: formTagMap,
  button: formTagMap,
  datalist: formTagMap,
  textarea: formTagMap,
  p: pTagMap,
  h1: pTagMap,
  h2: pTagMap,
  h3: pTagMap,
  h4: pTagMap,
  h5: pTagMap,
  h6: pTagMap,
  address: pTagMap,
  article: pTagMap,
  aside: pTagMap,
  blockquote: pTagMap,
  details: pTagMap,
  div: pTagMap,
  dl: pTagMap,
  fieldset: pTagMap,
  figcaption: pTagMap,
  figure: pTagMap,
  footer: pTagMap,
  form: pTagMap,
  header: pTagMap,
  hr: pTagMap,
  main: pTagMap,
  nav: pTagMap,
  ol: pTagMap,
  pre: pTagMap,
  section: pTagMap,
  table: pTagMap,
  ul: pTagMap,
  rt: clearPrototype({rt: 1, rp: 1}),
  rp: clearPrototype({rt: 1, rp: 1}),
  tbody: clearPrototype({thead: 1, tbody: 1}),
  tfoot: clearPrototype({thead: 1, tbody: 1}),
});
