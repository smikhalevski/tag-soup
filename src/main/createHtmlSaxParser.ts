import {IArrayLike, IParser, IParserOptions, ISaxHandler, IStartTagToken} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {decodeHtml} from 'speedy-entities';

/**
 * Creates a pre-configured HTML SAX parser.
 *
 * @param handler The parsing handler.
 * @param options Options that override the defaults.
 */
export function createHtmlSaxParser(handler: ISaxHandler, options?: IParserOptions): IParser<void> {
  return createSaxParser(handler, {...htmlParserOptions, ...options});
}

/**
 * The default HTML parser options:
 * - CDATA sections and processing instructions are treated as comments;
 * - Self-closing tags are treated as a start tags;
 * - Tags like `p`, `li`, `td` and others follow implicit end rules, so `<p>foo<p>bar` is parsed as
 * `<p>foo</p><p>bar</p>`;
 * - Tag and attribute names are converted to lower case;
 * - Legacy HTML entities are decoded in text and attribute values. To decode all known HTML entities use:
 *
 * ```ts
 * import {decodeHtml} from 'speedy-entities/lib/full';
 *
 * createHtmlSaxParser({
 *   decodeText: decodeHtml,
 *   decodeAttribute: decodeHtml,
 * });
 * ```
 *
 * @see {@link https://github.com/smikhalevski/speedy-entities decodeHtml}
 */
export const htmlParserOptions: IParserOptions = {
  decodeText: decodeHtml,
  decodeAttribute: decodeHtml,
  renameTag: toLowerCase,
  renameAttribute: toLowerCase,
  checkCdataTag,
  checkVoidTag,
  endsAncestorAt,
};

function toLowerCase(name: string): string {
  return name.toLowerCase();
}

function checkCdataTag(token: IStartTagToken): boolean {
  return cdataTags.has(token.name);
}

function checkVoidTag(token: IStartTagToken): boolean {
  return voidTags.has(token.name);
}

function endsAncestorAt(containerToken: IArrayLike<IStartTagToken>, token: IStartTagToken): number {
  const tagNames = implicitEndMap.get(token.name);
  if (tagNames) {
    for (let i = containerToken.length - 1; i >= 0; --i) {
      if (tagNames.has(containerToken[i].name)) {
        return i;
      }
    }
  }
  return -1;
}

const voidTags = toSet('area base basefont br col command embed frame hr img input isindex keygen link meta param source track wbr');

const cdataTags = toSet('script style textarea');

const formTags = toSet('input option optgroup select button datalist textarea');

const pTags = toSet('p');

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
  p: pTags,
  h1: pTags,
  h2: pTags,
  h3: pTags,
  h4: pTags,
  h5: pTags,
  h6: pTags,
  address: pTags,
  article: pTags,
  aside: pTags,
  blockquote: pTags,
  details: pTags,
  div: pTags,
  dl: pTags,
  fieldset: pTags,
  figcaption: pTags,
  figure: pTags,
  footer: pTags,
  form: pTags,
  header: pTags,
  hr: pTags,
  main: pTags,
  nav: pTags,
  ol: pTags,
  pre: pTags,
  section: pTags,
  table: pTags,
  ul: pTags,
  rt: toSet('rt rp'),
  rp: toSet('rt rp'),
  tbody: toSet('thead tbody'),
  tfoot: toSet('thead tbody'),
});

function toSet(data: string): Set<string> {
  return new Set(data.split(' '));
}

function toMap<V>(rec: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(rec));
}
