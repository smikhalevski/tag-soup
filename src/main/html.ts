import { decodeHTML, decodeHTMLAttribute, escapeXML } from 'speedy-entities';
import { createDOMParserFromConfig } from './createDOMParser.ts';
import { createSAXParserFromConfig } from './createSAXParser.ts';
import { createSerializer } from './createSerializer.ts';
import { createTokenizer } from './createTokenizer.ts';
import { resolveParserOptions } from './resolveParserOptions.ts';
import type { SerializerOptions, TagParsingOptions, TokenizerContextOptions, TokenizerOptions } from './types.ts';
import { toLowerCase } from './utils.ts';

const headingTagNames = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

const ddtTagNames = ['dd', 'dt'];

// Tags inside ruby that implicitly end each other
const rubyTagNames = ['rb', 'rp', 'rt', 'rtc'];

// Tags that implicitly end table sections, rows and cells, see the "in table body", "in row" and "in cell" insertion
// modes of https://html.spec.whatwg.org/multipage/parsing.html
const tableSectionTagNames = ['caption', 'col', 'colgroup', 'tbody', 'tfoot', 'thead'];

// Tags that implicitly end SVG and MathML, while other tags inside them don't end outer tags, see
// https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inforeign
const breakoutTagNames = [
  ...headingTagNames,
  'b',
  'big',
  'blockquote',
  'body',
  'br',
  'center',
  'code',
  'dd',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'head',
  'hr',
  'i',
  'img',
  'li',
  'listing',
  'menu',
  'meta',
  'nobr',
  'ol',
  'p',
  'pre',
  'ruby',
  's',
  'small',
  'span',
  'strong',
  'strike',
  'sub',
  'sup',
  'table',
  'tt',
  'u',
  'ul',
  'var',
];

// Options of SVG and MathML content, their tags are assigned after HTML options
const svgOptions: TokenizerContextOptions = {
  areCDATASectionsRecognized: true,
  areSelfClosingTagsRecognized: true,
  processingInstructionSyntax: 'html',
};

const mathmlOptions: TokenizerContextOptions = {
  areCDATASectionsRecognized: true,
  areSelfClosingTagsRecognized: true,
  processingInstructionSyntax: 'html',
};

// Implicit ending scopes and end tag scope levels follow
// https://html.spec.whatwg.org/multipage/parsing.html#has-an-element-in-scope
const htmlTags: Record<string, TagParsingOptions> = {
  a: {
    implicitEndingTagNames: ['a'],
  },
  'annotation-xml': {
    isImplicitEndingScope: true,
  },
  applet: {
    isImplicitEndingScope: true,
    endTagScopeLevel: 1,
  },
  area: {
    kind: 'void',
  },
  base: {
    kind: 'void',
  },
  basefont: {
    kind: 'void',
  },
  bgsound: {
    kind: 'void',
  },
  br: {
    kind: 'void',
    isImplicitlyStarted: true,
  },
  button: {
    implicitEndingTagNames: ['button'],
    isImplicitEndingScope: true,
  },
  caption: {
    implicitEndingTagNames: ['tr', 'th', 'td', ...tableSectionTagNames],
    isImplicitEndingScope: true,
    endTagScopeLevel: 1,
  },
  col: {
    kind: 'void',
  },
  colgroup: {
    implicitEndingTagNames: ['caption', 'colgroup', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr'],
  },
  dd: {
    implicitEndingTagNames: ddtTagNames,
  },
  desc: {
    isImplicitEndingScope: true,
  },
  dl: {
    isImplicitEndingScope: true,
  },
  dt: {
    implicitEndingTagNames: ddtTagNames,
  },
  embed: {
    kind: 'void',
  },
  foreignObject: {
    isImplicitEndingScope: true,
  },
  frame: {
    kind: 'void',
  },
  h1: {
    implicitEndingTagNames: headingTagNames,
  },
  h2: {
    implicitEndingTagNames: headingTagNames,
  },
  h3: {
    implicitEndingTagNames: headingTagNames,
  },
  h4: {
    implicitEndingTagNames: headingTagNames,
  },
  h5: {
    implicitEndingTagNames: headingTagNames,
  },
  h6: {
    implicitEndingTagNames: headingTagNames,
  },
  head: {
    implicitEndingTagNames: ['body'],
  },
  hr: {
    kind: 'void',
  },
  html: {
    isImplicitEndingScope: true,
  },
  iframe: {
    kind: 'raw_text',
  },
  img: {
    kind: 'void',
  },
  input: {
    kind: 'void',
  },
  keygen: {
    kind: 'void',
  },
  li: {
    implicitEndingTagNames: ['li'],
  },
  link: {
    kind: 'void',
    implicitEndingTagNames: ['body'],
  },
  marquee: {
    isImplicitEndingScope: true,
    endTagScopeLevel: 1,
  },
  math: {
    implicitEndingTagNames: breakoutTagNames,
    isImplicitEndingScope: true,
    foreignContext: mathmlOptions,
  },
  meta: {
    kind: 'void',
  },
  mi: {
    isImplicitEndingScope: true,
  },
  mn: {
    isImplicitEndingScope: true,
  },
  mo: {
    isImplicitEndingScope: true,
  },
  ms: {
    isImplicitEndingScope: true,
  },
  mtext: {
    isImplicitEndingScope: true,
  },
  noembed: {
    kind: 'raw_text',
  },
  noframes: {
    kind: 'raw_text',
  },
  object: {
    isImplicitEndingScope: true,
    endTagScopeLevel: 1,
  },
  ol: {
    isImplicitEndingScope: true,
  },
  optgroup: {
    implicitEndingTagNames: ['hr', 'optgroup'],
  },
  option: {
    implicitEndingTagNames: ['hr', 'optgroup', 'option'],
  },
  p: {
    implicitEndingTagNames: [
      ...headingTagNames,
      'address',
      'article',
      'aside',
      'blockquote',
      'center',
      'dd',
      'details',
      'dialog',
      'dir',
      'div',
      'dl',
      'dt',
      'fieldset',
      'figcaption',
      'figure',
      'footer',
      'form',
      'header',
      'hgroup',
      'hr',
      'li',
      'listing',
      'main',
      'menu',
      'nav',
      'ol',
      'p',
      'plaintext',
      'pre',
      'search',
      'section',
      'summary',
      'table',
      'ul',
      'xmp',
    ],
    isImplicitlyStarted: true,
  },
  param: {
    kind: 'void',
  },
  plaintext: {
    kind: 'raw_text',
  },
  rb: {
    implicitEndingTagNames: rubyTagNames,
  },
  rp: {
    implicitEndingTagNames: rubyTagNames,
  },
  rt: {
    implicitEndingTagNames: rubyTagNames,
  },
  rtc: {
    implicitEndingTagNames: ['rb', 'rtc'],
  },
  script: {
    kind: 'script_data',
    implicitEndingTagNames: ['body'],
  },
  select: {
    implicitEndingTagNames: ['input', 'select'],
  },
  source: {
    kind: 'void',
  },
  style: {
    kind: 'raw_text',
  },
  svg: {
    implicitEndingTagNames: breakoutTagNames,
    isImplicitEndingScope: true,
    foreignContext: svgOptions,
  },
  table: {
    implicitEndingTagNames: ['table'],
    isImplicitEndingScope: true,
    endTagScopeLevel: 2,
  },
  tbody: {
    implicitEndingTagNames: tableSectionTagNames,
    endTagScopeLevel: 1,
  },
  td: {
    implicitEndingTagNames: ['tr', 'th', 'td', ...tableSectionTagNames],
    isImplicitEndingScope: true,
    endTagScopeLevel: 1,
  },
  template: {
    isImplicitEndingScope: true,
    endTagScopeLevel: 3,
  },
  textarea: {
    kind: 'escapable_raw_text',
  },
  tfoot: {
    implicitEndingTagNames: tableSectionTagNames,
    endTagScopeLevel: 1,
  },
  th: {
    implicitEndingTagNames: ['tr', 'th', 'td', ...tableSectionTagNames],
    isImplicitEndingScope: true,
    endTagScopeLevel: 1,
  },
  thead: {
    implicitEndingTagNames: tableSectionTagNames,
    endTagScopeLevel: 1,
  },
  title: {
    kind: 'escapable_raw_text',
  },
  tr: {
    implicitEndingTagNames: ['tr', ...tableSectionTagNames],
    endTagScopeLevel: 1,
  },
  track: {
    kind: 'void',
  },
  ul: {
    isImplicitEndingScope: true,
  },
  wbr: {
    kind: 'void',
  },
  xmp: {
    kind: 'raw_text',
  },
};

const htmlTokenizerOptions: TokenizerOptions = {
  tags: htmlTags,
  areTagNamesCaseInsensitive: true,
  areUnbalancedStartTagsImplicitlyEnded: true,
  areUnbalancedEndTagsIgnored: true,
  processingInstructionSyntax: 'html',
};

// Inside SVG and MathML, svg and math don't switch options again, and title is a normal tag rather than escapable raw
// text, since SVG title is an HTML integration point, see
// https://html.spec.whatwg.org/multipage/parsing.html#html-integration-point
// Tags in SVG and MathML have no end tag scope levels, so an end tag there can end any enclosing tag. Only
// foreignObject gets an end tag scope level below.
const foreignContentTags: Record<string, TagParsingOptions> = {};

for (const [tagName, tagOptions] of Object.entries(htmlTags)) {
  foreignContentTags[tagName] = { ...tagOptions, endTagScopeLevel: 0 };
}

foreignContentTags.math = {
  implicitEndingTagNames: breakoutTagNames,
  isImplicitEndingScope: true,
};
foreignContentTags.svg = {
  implicitEndingTagNames: breakoutTagNames,
  isImplicitEndingScope: true,
};
foreignContentTags.title = {
  isImplicitEndingScope: true,
};

mathmlOptions.tags = foreignContentTags;

svgOptions.tags = {
  ...foreignContentTags,

  // Content of foreignObject is read as HTML
  foreignObject: {
    isImplicitEndingScope: true,
    endTagScopeLevel: 1,
    foreignContext: htmlTokenizerOptions,
  },
};

const htmlSerializerOptions: SerializerOptions = {
  tags: htmlTags,
  areTagNamesCaseInsensitive: true,
  areSelfClosingTagsSupported: false,
  encodeText: escapeXML,
  encodeAttribute: escapeXML,
};

/**
 * Reads tokens from HTML markup. Never throws, malformed markup is recovered the way browsers do in most cases.
 *
 * @group Tokenizer
 */
export const HTMLTokenizer = createTokenizer(htmlTokenizerOptions);

const htmlParserConfig = resolveParserOptions({
  tokenizer: HTMLTokenizer,
  decodeText: decodeHTML,
  decodeAttribute: decodeHTMLAttribute,
  renameTag: toLowerCase,
  renameAttribute: toLowerCase,
});

/**
 * Parses HTML markup as a DOM. Decodes HTML entities in text with
 * [`decodeHTML`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTML.html), and in attribute values with
 * [`decodeHTMLAttribute`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTMLAttribute.html). Never
 * throws, malformed markup is recovered the way browsers do in most cases.
 *
 * @group DOM
 */
export const HTMLDOMParser = createDOMParserFromConfig(htmlParserConfig);

/**
 * Parses HTML markup and calls {@link SAXHandler} methods when tokens are read. Decodes HTML entities in text with
 * [`decodeHTML`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTML.html), and in attribute values with
 * [`decodeHTMLAttribute`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTMLAttribute.html). Never
 * throws, malformed markup is recovered the way browsers do in most cases.
 *
 * @group SAX
 */
export const HTMLSAXParser = createSAXParserFromConfig(htmlParserConfig);

/**
 * Serializes a DOM node as an HTML string. Encodes text and attribute values with
 * [`escapeXML`](https://smikhalevski.github.io/speedy-entities/functions/escapeXML.html), except for text of `raw_text`
 * and `script_data` tags, like `style` and `script`.
 *
 * @group Serializer
 */
export const toHTML = createSerializer(htmlSerializerOptions);
