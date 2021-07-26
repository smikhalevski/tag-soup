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

export const htmlParserOptions: IParserOptions = {
  decodeText: decodeHtml,
  decodeAttribute: decodeHtml,
  renameTag: (name) => name.toLowerCase(),
  checkCdataTag: checkHtmlCdataTag,
  checkVoidTag: checkHtmlVoidTag,
  endsAncestorAt: htmlEndsAncestorAt,
};

export function checkHtmlCdataTag(token: IStartTagToken): boolean {
  return searchTrie(htmlCdataTagNames, token.name, 0)?.value === true;
}

export function checkHtmlVoidTag(token: IStartTagToken): boolean {
  return searchTrie(htmlVoidTagNames, token.name, 0)?.value === true;
}

export function htmlEndsAncestorAt(containerToken: IArrayLike<IStartTagToken>, token: IStartTagToken): number {
  const a = searchTrie(htmlImplicitEndTagNameMap, token.name, 0)?.value;// htmlImplicitEndTagNameMap[token.name];
  if (a !== undefined) {
    for (let i = containerToken.length - 1; i >= 0; --i) {
      if (searchTrie(a, containerToken[i].name, 0)?.value) {
        return i;
      }
    }
  }
  return -1;
}

const htmlVoidTagNames = toTrie('area base basefont br col command embed frame hr img input isindex keygen link meta param source track wbr');

const htmlCdataTagNames = toTrie('script style textarea');

const htmlFormTagNames = toTrie('input option optgroup select button datalist textarea');

const htmlParagraphTagName = toTrie('p');

const htmlImplicitEndTagNameMap = toTrie2({
  tr: toTrie('tr th td'),
  th: toTrie('th'),
  td: toTrie('thead th td'),
  body: toTrie('head link script'),
  li: toTrie('li'),
  option: toTrie('option'),
  optgroup: toTrie('optgroup option'),
  dd: toTrie('dt dd'),
  dt: toTrie('dt dd'),
  select: htmlFormTagNames,
  input: htmlFormTagNames,
  output: htmlFormTagNames,
  button: htmlFormTagNames,
  datalist: htmlFormTagNames,
  textarea: htmlFormTagNames,
  p: htmlParagraphTagName,
  h1: htmlParagraphTagName,
  h2: htmlParagraphTagName,
  h3: htmlParagraphTagName,
  h4: htmlParagraphTagName,
  h5: htmlParagraphTagName,
  h6: htmlParagraphTagName,
  address: htmlParagraphTagName,
  article: htmlParagraphTagName,
  aside: htmlParagraphTagName,
  blockquote: htmlParagraphTagName,
  details: htmlParagraphTagName,
  div: htmlParagraphTagName,
  dl: htmlParagraphTagName,
  fieldset: htmlParagraphTagName,
  figcaption: htmlParagraphTagName,
  figure: htmlParagraphTagName,
  footer: htmlParagraphTagName,
  form: htmlParagraphTagName,
  header: htmlParagraphTagName,
  hr: htmlParagraphTagName,
  main: htmlParagraphTagName,
  nav: htmlParagraphTagName,
  ol: htmlParagraphTagName,
  pre: htmlParagraphTagName,
  section: htmlParagraphTagName,
  table: htmlParagraphTagName,
  ul: htmlParagraphTagName,
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
