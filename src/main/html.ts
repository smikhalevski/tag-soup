import {createSaxParser, SaxParser, SaxParserOptions} from './createSaxParser';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {createFromHtmlCharName} from './createFromHtmlCharName';
import {createFromCharCode} from './createFromCharCode';
import {DomParser} from './createDomParser';
import {
  createTagSoupDomParser,
  TagSoupDomParserOptions,
  TagSoupElement,
  TagSoupNode,
  TagSoupText,
} from './createTagSoupDomParser';

const fromCharCode = createFromCharCode();

const htmlAttrDecoder = createEntitiesDecoder({
  fromCharName: createFromHtmlCharName({strict: true}),
  fromCharCode,
});

const htmlTestDecoder = createEntitiesDecoder({
  fromCharName: createFromHtmlCharName(),
  fromCharCode,
});

function isRawTag(tagName: string): boolean {
  return rawTags.has(tagName.toLowerCase());
}

export function createHtmlSaxParser(options: SaxParserOptions): SaxParser {
  const saxParserOptions: SaxParserOptions = {
    xmlEnabled: false,
    selfClosingEnabled: false,
    decodeAttr: htmlAttrDecoder,
    decodeText: htmlTestDecoder,
    isRawTag,
  };
  return createSaxParser(Object.assign(saxParserOptions, options));
}

export function createHtmlTagSoupDomParser(options: TagSoupDomParserOptions): DomParser<TagSoupNode, TagSoupElement, TagSoupText> {
  const domParserOptions: TagSoupDomParserOptions = {
    xmlEnabled: false,
    selfClosingEnabled: false,
    decodeAttr: htmlAttrDecoder,
    decodeText: htmlTestDecoder,
    isRawTag,
    isImplicitClose(parentEl, el) {
      return implicitCloseMap[parentEl.tagName.toLowerCase()]?.has(el.tagName.toLowerCase()) ?? false;
    },
    isVoidElement(el) {
      return voidTags.has(el.tagName.toLowerCase());
    },
  };
  return createTagSoupDomParser(Object.assign(domParserOptions, options));
}

const rawTags = new Set([
  'script',
  'style',
  'textarea',
]);

const voidTags = new Set([
  'area',
  'base',
  'basefont',
  'br',
  'col',
  'command',
  'embed',
  'frame',
  'hr',
  'img',
  'input',
  'isindex',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const formTags = new Set([
  'input',
  'option',
  'optgroup',
  'select',
  'button',
  'datalist',
  'textarea',
]);

const pTag = new Set(['p']);

const implicitCloseMap: Record<string, Set<string>> = {
  tr: new Set(['tr', 'th', 'td']),
  th: new Set(['th']),
  td: new Set(['thead', 'th', 'td']),
  body: new Set(['head', 'link', 'script']),
  li: new Set(['li']),
  p: pTag,
  h1: pTag,
  h2: pTag,
  h3: pTag,
  h4: pTag,
  h5: pTag,
  h6: pTag,
  select: formTags,
  input: formTags,
  output: formTags,
  button: formTags,
  datalist: formTags,
  textarea: formTags,
  option: new Set(['option']),
  optgroup: new Set(['optgroup', 'option']),
  dd: new Set(['dt', 'dd']),
  dt: new Set(['dt', 'dd']),
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
  rt: new Set(['rt', 'rp']),
  rp: new Set(['rt', 'rp']),
  tbody: new Set(['thead', 'tbody']),
  tfoot: new Set(['thead', 'tbody']),
};
