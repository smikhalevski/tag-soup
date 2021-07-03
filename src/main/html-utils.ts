import {IStartTagToken, ITagToken} from './token-types';
import {toMap, toSet} from './utils';

export function isHtmlTextContent(token: IStartTagToken): boolean {
  return textTags.has(token.name);
}

export function isHtmlVoidContent(token: IStartTagToken): boolean {
  return voidTags.has(token.name);
}

export function isHtmlImplicitEnd(containerToken: ITagToken, token: IStartTagToken): boolean {
  return implicitEndMap.get(containerToken.name)?.has(token.name) === true;
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
