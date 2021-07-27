import {IArrayLike, IParser, IParserOptions, ISaxHandler, IStartTagToken} from './parser-types';
import {createSaxParser} from './createSaxParser';
import {decodeHtml} from 'speedy-entities';
import {objectCopy} from './misc';
import {createTrieNode, ITrieNode, searchTrie, setTrie} from '@smikhalevski/trie';

/**
 * Creates a pre-configured HTML SAX parser.
 *
 * @param handler The parsing handler.
 * @param options Options that override the defaults.
 */
export function createHtmlSaxParser(handler: ISaxHandler, options?: IParserOptions): IParser<void> {
  return createSaxParser(handler, objectCopy(htmlParserOptions, options));
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
  renameTag: (name) => name.toLowerCase(),
  renameAttribute: (name) => name.toLowerCase(),
  checkCdataTag: checkHtmlCdataTag,
  checkVoidTag: checkHtmlVoidTag,
  endsAncestorAt: htmlEndsAncestorAt,
};

export function checkHtmlCdataTag(token: IStartTagToken): boolean {
  return searchTrie(cdataTags, token.name, 0)?.value === true;
}

export function checkHtmlVoidTag(token: IStartTagToken): boolean {
  return searchTrie(voidTags, token.name, 0)?.value === true;
}

export function htmlEndsAncestorAt(containerToken: IArrayLike<IStartTagToken>, token: IStartTagToken): number {
  const a = searchTrie(implicitEnds, token.name, 0)?.value;// htmlImplicitEndTagNameMap[token.name];
  if (a !== undefined) {
    for (let i = containerToken.length - 1; i >= 0; --i) {
      if (searchTrie(a, containerToken[i].name, 0)?.value) {
        return i;
      }
    }
  }
  return -1;
}

const voidTags = toTrie('area base basefont br col command embed frame hr img input isindex keygen link meta param source track wbr');

const cdataTags = toTrie('script style textarea');

const formTags = toTrie('input option optgroup select button datalist textarea');

const paragraphTags = toTrie('p');

const implicitEnds = toTrie2({
  tr: toTrie('tr th td'),
  th: toTrie('th'),
  td: toTrie('thead th td'),
  body: toTrie('head link script'),
  li: toTrie('li'),
  option: toTrie('option'),
  optgroup: toTrie('optgroup option'),
  dd: toTrie('dt dd'),
  dt: toTrie('dt dd'),
  select: formTags,
  input: formTags,
  output: formTags,
  button: formTags,
  datalist: formTags,
  textarea: formTags,
  p: paragraphTags,
  h1: paragraphTags,
  h2: paragraphTags,
  h3: paragraphTags,
  h4: paragraphTags,
  h5: paragraphTags,
  h6: paragraphTags,
  address: paragraphTags,
  article: paragraphTags,
  aside: paragraphTags,
  blockquote: paragraphTags,
  details: paragraphTags,
  div: paragraphTags,
  dl: paragraphTags,
  fieldset: paragraphTags,
  figcaption: paragraphTags,
  figure: paragraphTags,
  footer: paragraphTags,
  form: paragraphTags,
  header: paragraphTags,
  hr: paragraphTags,
  main: paragraphTags,
  nav: paragraphTags,
  ol: paragraphTags,
  pre: paragraphTags,
  section: paragraphTags,
  table: paragraphTags,
  ul: paragraphTags,
  rt: toTrie('rt rp'),
  rp: toTrie('rt rp'),
  tbody: toTrie('thead tbody'),
  tfoot: toTrie('thead tbody'),
});

function toTrie(data: string): ITrieNode<true> {
  const trie = createTrieNode<true>();
  data.split(' ').forEach((_) => setTrie(trie, _, true));
  return trie;
}

function toTrie2<V>(record: Record<string, V>): ITrieNode<V> {
  const trie = createTrieNode<V>();
  for (const key in record) {
    if (record.hasOwnProperty(key)) {
      setTrie(trie, key, record[key]);
    }
  }
  return trie;
}
