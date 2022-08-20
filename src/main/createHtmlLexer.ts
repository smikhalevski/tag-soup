import { createLexer } from './createLexer';
import { Lexer, LexerOptions } from './lexer-types';
import { defaults } from './utils';

export function createHtmlLexer(options?: LexerOptions): Lexer {
  return createLexer(defaults(options, htmlLexerOptions));
}

// prettier-ignore
const voidTags = 'area base basefont br col command embed frame hr img input isindex keygen link meta param source track wbr'.split(' ');

const cdataTags = 'script style textarea'.split(' ');

const formTags = 'input option optgroup select button datalist textarea'.split(' ');

const pTags = ['p'];

const ddtTags = ['dd', 'dt'];

const rtpTags = ['rt', 'rp'];

const tableTags = ['thead', 'tbody'];

const implicitStartTags = ['p', 'br'];

const implicitEndTags = {
  tr: ['tr', 'th', 'td'],
  th: ['th'],
  td: ['thead', 'th', 'td'],
  body: ['head', 'link', 'script'],
  li: ['li'],
  option: ['option'],
  optgroup: ['optgroup', 'option'],
  dd: ddtTags,
  dt: ddtTags,
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
  rt: rtpTags,
  rp: rtpTags,
  tbody: tableTags,
  tfoot: tableTags,
};

const htmlLexerOptions: LexerOptions = {
  voidTags,
  cdataTags,
  implicitStartTags,
  implicitEndTags,
  caseInsensitiveTagsEnabled: true,
};
