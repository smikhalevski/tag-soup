import {createLexer, Lexer, LexerOptions} from './lexer';

export function createHtmlLexer(options: LexerOptions = {}): Lexer {
  return createLexer(Object.assign({voidTags, cdataTags, implicitEndTags}, options));
}

const voidTags = 'area base basefont br col command embed frame hr img input isindex keygen link meta param source track wbr'.split(' ');

const cdataTags = 'script style textarea'.split(' ');

const formTags = 'input option optgroup select button datalist textarea'.split(' ');

const pTags = ['p'];

const implicitEndTags = {
  tr: ['tr', 'th', 'td'],
  th: ['th'],
  td: ['thead', 'th', 'td'],
  body: ['head', 'link', 'script'],
  li: ['li'],
  option: ['option'],
  optgroup: ['optgroup', 'option'],
  dd: ['dt', 'dd'],
  dt: ['dt', 'dd'],
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
  rt: ['rt', 'rp'],
  rp: ['rt', 'rp'],
  tbody: ['thead', 'tbody'],
  tfoot: ['thead', 'tbody'],
};
