import {SaxParser} from './createSaxParser';
import {createEntitiesDecoder} from './createEntitiesDecoder';
import {createFromHtmlCharName} from './createFromHtmlCharName';
import {createFromCharCode} from './createFromCharCode';
import {
  createTagSoupDomParser,
  TagSoupDomParserOptions,
  TagSoupElement,
  TagSoupNode,
  TagSoupText,
} from './createTagSoupDomParser';
import {DomParser} from './createDomParser';
import {createForgivingSaxParser, ForgivingSaxParserOptions} from './createForgivingSaxParser';
import {TagType} from './TagType';

const fromCharCode = createFromCharCode();

const htmlAttrDecoder = createEntitiesDecoder({
  fromCharName: createFromHtmlCharName({strict: true}),
  fromCharCode,
});

const htmlTestDecoder = createEntitiesDecoder({
  fromCharName: createFromHtmlCharName(),
  fromCharCode,
});

export function createHtmlSaxParser(options: ForgivingSaxParserOptions): SaxParser {
  const saxParserOptions: ForgivingSaxParserOptions = {
    xmlEnabled: false,
    selfClosingEnabled: false,
    decodeAttr: htmlAttrDecoder,
    decodeText: htmlTestDecoder,
    // isEmittedAsText,
    // isImplicitEnd,
    getTagType,
  };
  return createForgivingSaxParser(Object.assign(saxParserOptions, options));
}

export function createHtmlTagSoupDomParser(options: TagSoupDomParserOptions = {}): DomParser<TagSoupNode, TagSoupElement, TagSoupText> {
  const domParserOptions: TagSoupDomParserOptions = {
    xmlEnabled: false,
    selfClosingEnabled: false,
    decodeAttr: htmlAttrDecoder,
    decodeText: htmlTestDecoder,
    isEmittedAsText,
    isImplicitEnd,
    getTagType,
  };
  return createTagSoupDomParser(Object.assign(domParserOptions, options));
}

const voidSet = new Set([
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
])

function getTagType(t:string) {
  // if (voidSet.has(t)) {
  //   return TagType.VOID;
  // }
  // if (t === 'script' || t === 'style') {
  //   return TagType.TEXT;
  // }

  // switch (t) {
  //   case 'area':
  //   case 'base':
  //   case 'basefont':
  //   case 'br':
  //   case 'col':
  //   case 'command':
  //   case 'embed':
  //   case 'frame':
  //   case 'hr':
  //   case 'img':
  //   case 'input':
  //   case 'isindex':
  //   case 'keygen':
  //   case 'link':
  //   case 'meta':
  //   case 'param':
  //   case 'source':
  //   case 'track':
  //   case 'wbr':
  //     return TagType.VOID;
  //
  //   case 'script':
  //   case 'style':
  //     return TagType.TEXT;
  // }
  return TagType.FLOW;
}

function isEmittedAsText(t: string) {
  return t === 'script' || t === 'style' || t === 'textarea';
}

function isImplicitEnd(t1: string, t2: string) {
  switch (t1) {
    case 'tr':return t2 === 'tr' || t2 === 'th' || t2 === 'td'
    case 'th': return t2 === 'th';
    case 'td':return  t2 === 'thead' || t2 === 'th' || t2 === 'td'
    case 'body':return t2 === 'head' || t2 === 'link' || t2 === 'script'
    case 'li': return t2 === 'li'
    case 'option': return t2 === 'option'
    case 'optgroup':return t2 === 'optgroup' || t2 === 'option'
    case 'dd': return  t2 === 'dt' || t2 === 'dd'
    case 'dt': return  t2 === 'dt' || t2 === 'dd'
    case 'select':
    case 'input':
    case 'output':
    case 'button':
    case 'datalist':
    case 'textarea':
      return t2 === 'input'
      || t2 === 'option'
      || t2 === 'optgroup'
      || t2 === 'select'
      || t2 === 'button'
      || t2 === 'datalist'
      || t2 === 'textarea';

    case 'p':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
    case 'address':
    case 'article':
    case 'aside':
    case 'blockquote':
    case 'details':
    case 'div':
    case 'dl':
    case 'fieldset':
    case 'figcaption':
    case 'figure':
    case 'footer':
    case 'form':
    case 'header':
    case 'hr':
    case 'main':
    case 'nav':
    case 'ol':
    case 'pre':
    case 'section':
    case 'table':
    case 'ul':return t2 === 'p';
    case 'rt': return t2 === 'rt' || t2 === 'rp'
    case 'rp': return t2 === 'rt' || t2 === 'rp'
    case 'tbody': return t2 === 'thead' || t2 === 'tbody'
    case 'tfoot': return t2 === 'thead' || t2 === 'tbody'
  }
  return false;
}
