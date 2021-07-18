import {IStartTagToken, ITagToken} from './token-types';
import {toMap, toSet} from './utils';

export function checkHtmlCdataTag(token: IStartTagToken): boolean {
  return htmlCdataTagNames.has(token.name);
}

export function checkHtmlVoidTag(token: IStartTagToken): boolean {
  return htmlVoidTagNames.has(token.name);
}

export function checkHtmlImplicitEndTag(containerToken: ITagToken, token: IStartTagToken): boolean {
  return htmlImplicitEndTagNameMap.get(containerToken.name)?.has(token.name) === true;
}

const htmlVoidTagNames = toSet('area base basefont br col command embed frame hr img input isindex keygen link meta param source track wbr');

const htmlCdataTagNames = toSet('script style textarea');

const htmlFormTagNames = toSet('input option optgroup select button datalist textarea');

const htmlParagraphTagName = toSet('p');

const htmlImplicitEndTagNameMap = toMap({
  tr: toSet('tr th td'),
  th: toSet('th'),
  td: toSet('thead th td'),
  body: toSet('head link script'),
  li: toSet('li'),
  option: toSet('option'),
  optgroup: toSet('optgroup option'),
  dd: toSet('dt dd'),
  dt: toSet('dt dd'),
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
  rt: toSet('rt rp'),
  rp: toSet('rt rp'),
  tbody: toSet('thead tbody'),
  tfoot: toSet('thead tbody'),
});
