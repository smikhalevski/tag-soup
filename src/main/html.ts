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
  return rawTags.includes(tagName);
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

export function createHtmlTagSoupDomParser(options: TagSoupDomParserOptions = {}): DomParser<TagSoupNode, TagSoupElement, TagSoupText> {
  const domParserOptions: TagSoupDomParserOptions = {
    xmlEnabled: false,
    selfClosingEnabled: false,
    decodeAttr: htmlAttrDecoder,
    decodeText: htmlTestDecoder,
    isRawTag,
    isImplicitEnd(parentEl, el) {
      return implicitCloseMap[parentEl.tagName]?.includes(el.tagName);
    },
    isVoidElement(el) {
      return voidTags.includes(el.tagName);
    },
  };
  return createTagSoupDomParser(Object.assign(domParserOptions, options));
}

const rawTags = [
  'script',
  'style',
  'textarea',
];

const voidTags = [
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
];

const formTags = [
  'input',
  'option',
  'optgroup',
  'select',
  'button',
  'datalist',
  'textarea',
];

const pTag = ['p'];

const implicitCloseMap: Record<string, Array<string>> = {
  tr: ['tr', 'th', 'td'],
  th: ['th'],
  td: ['thead', 'th', 'td'],
  body: ['head', 'link', 'script'],
  li: ['li'],
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
  option: ['option'],
  optgroup: ['optgroup', 'option'],
  dd: ['dt', 'dd'],
  dt: ['dt', 'dd'],
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
  rt: ['rt', 'rp'],
  rp: ['rt', 'rp'],
  tbody: ['thead', 'tbody'],
  tfoot: ['thead', 'tbody'],
};
