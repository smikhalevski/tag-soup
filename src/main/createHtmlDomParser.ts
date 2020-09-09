import {createForgivingSaxParser, ForgivingSaxParserOptions} from './createForgivingSaxParser';
import {createFromCharCode, FromCharCodeOptions} from './createFromCharCode';
import {lowerCase, SaxParser, SaxParserCallbacks} from './createSaxParser';
import {createFromHtmlCharName} from './createFromHtmlCharName';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {DomParser, DomParserDialectOptions} from './createDomParser';
import {createXmlDomParser, DomElement, DomNode, DomText} from './createXmlDomParser';
import {pure} from './parser-utils';

export interface HtmlDialectOptions extends FromCharCodeOptions {

  /**
   * If set to `true` then:
   * - self-closing tags are parsed;
   * - all non-void elements are expected to be closed (no implicit end checks are not performed).
   *
   * @default false
   */
  xhtmlEnabled?: boolean;

  /**
   * If set to `true` then:
   * - does not recognize non-terminated and legacy HTML entities;
   * - throws an error if decoder meets a disallowed character reference.
   *
   * @default false
   */
  strict?: boolean;
}

export interface HtmlSaxParserOptions extends HtmlDialectOptions, SaxParserCallbacks {
}

export function createHtmlSaxParser(options: HtmlSaxParserOptions): SaxParser {
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

  const saxParserOptions: ForgivingSaxParserOptions = {
    xmlEnabled: false,
    selfClosingEnabled: xhtmlEnabled,
    decodeAttr: htmlAttrDecoder,
    decodeText: htmlTextDecoder,

    isTextContent: (tagName) => textTagMap[tagName] === 1,
    isVoidContent: (tagName) => voidTagMap[tagName] === 1,
    isImplicitEnd: xhtmlEnabled ? undefined : (currentTagName, tagName) => implicitEndMap[currentTagName]?.[tagName] === 1,

    renameTag: lowerCase,
  };

  return createForgivingSaxParser(Object.assign({}, options, saxParserOptions));
}

export interface HtmlDomParserOptions extends HtmlDialectOptions {
}

export function createHtmlDomParser(options?: HtmlDomParserOptions): DomParser<DomNode, DomElement, DomText> {
  const domParserOptions: DomParserDialectOptions<DomElement> = {
    saxParserFactory: createHtmlSaxParser,
  };
  return createXmlDomParser(Object.assign({}, options, domParserOptions));
}

const voidTagMap = pure<Record<string, 1>>({
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

const textTagMap = pure<Record<string, 1>>({
  script: 1,
  style: 1,
  textarea: 1,
});

const formTagMap = pure<Record<string, 1>>({
  input: 1,
  option: 1,
  optgroup: 1,
  select: 1,
  button: 1,
  datalist: 1,
  textarea: 1,
});

const pTagMap = pure<Record<string, 1>>({p: 1});

const implicitEndMap = pure<Record<string, Record<string, 1>>>({
  tr: pure({tr: 1, th: 1, td: 1}),
  th: pure({th: 1}),
  td: pure({thead: 1, th: 1, td: 1}),
  body: pure({head: 1, link: 1, script: 1}),
  li: pure({li: 1}),
  option: pure({option: 1}),
  optgroup: pure({optgroup: 1, option: 1}),
  dd: pure({dt: 1, dd: 1}),
  dt: pure({dt: 1, dd: 1}),
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
  rt: pure({rt: 1, rp: 1}),
  rp: pure({rt: 1, rp: 1}),
  tbody: pure({thead: 1, tbody: 1}),
  tfoot: pure({thead: 1, tbody: 1}),
});
