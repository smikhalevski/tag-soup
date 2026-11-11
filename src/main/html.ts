import { decodeHTML, decodeHTMLAttribute, escapeXML } from 'speedy-entities';
import { createDOMParser } from './createDOMParser.ts';
import { createSAXParser } from './createSAXParser.ts';
import { createSerializer } from './createSerializer.ts';
import { createTokenizer } from './createTokenizer.ts';
import type { ParserOptions, SerializerOptions, TokenizerContextOptions } from './types.ts';

// Tags that implicitly end form controls
const formTagNames = ['button', 'datalist', 'input', 'output', 'select', 'textarea'];

const headingTagNames = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

const ddtTagNames = ['dd', 'dt'];

// Tags inside ruby that implicitly end each other
const rubyTagNames = ['rb', 'rp', 'rt', 'rtc'];

const tableSectionTagNames = ['tbody', 'tfoot'];

// Tags that implicitly end SVG and MathML, other tags inside them don't end outer tags, see
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
  areProcessingInstructionsRecognized: true,
  areSelfClosingTagsRecognized: true,
};

const mathmlOptions: TokenizerContextOptions = {
  areCDATASectionsRecognized: true,
  areProcessingInstructionsRecognized: true,
  areSelfClosingTagsRecognized: true,
};

const htmlParserOptions: ParserOptions = {
  // Implicit ending boundaries follow https://html.spec.whatwg.org/multipage/parsing.html#has-an-element-in-scope
  tags: {
    a: {
      implicitEndingTagNames: ['a'],
    },
    'annotation-xml': {
      isImplicitEndingBoundary: true,
    },
    applet: {
      isImplicitEndingBoundary: true,
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
      implicitEndingTagNames: formTagNames,
      isImplicitEndingBoundary: true,
    },
    caption: {
      isImplicitEndingBoundary: true,
    },
    col: {
      kind: 'void',
    },
    datalist: {
      implicitEndingTagNames: formTagNames,
    },
    dd: {
      implicitEndingTagNames: ddtTagNames,
    },
    desc: {
      isImplicitEndingBoundary: true,
    },
    dl: {
      isImplicitEndingBoundary: true,
    },
    dt: {
      implicitEndingTagNames: ddtTagNames,
    },
    embed: {
      kind: 'void',
    },
    foreignObject: {
      isImplicitEndingBoundary: true,
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
      isImplicitEndingBoundary: true,
    },
    iframe: {
      kind: 'raw_text',
    },
    img: {
      kind: 'void',
    },
    input: {
      kind: 'void',
      implicitEndingTagNames: formTagNames,
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
      isImplicitEndingBoundary: true,
    },
    math: {
      implicitEndingTagNames: breakoutTagNames,
      isImplicitEndingBoundary: true,
      foreignContext: mathmlOptions,
    },
    meta: {
      kind: 'void',
    },
    mi: {
      isImplicitEndingBoundary: true,
    },
    mn: {
      isImplicitEndingBoundary: true,
    },
    mo: {
      isImplicitEndingBoundary: true,
    },
    ms: {
      isImplicitEndingBoundary: true,
    },
    mtext: {
      isImplicitEndingBoundary: true,
    },
    noembed: {
      kind: 'raw_text',
    },
    noframes: {
      kind: 'raw_text',
    },
    object: {
      isImplicitEndingBoundary: true,
    },
    ol: {
      isImplicitEndingBoundary: true,
    },
    optgroup: {
      implicitEndingTagNames: [...formTagNames, 'optgroup'],
    },
    option: {
      implicitEndingTagNames: [...formTagNames, 'optgroup', 'option'],
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
      implicitEndingTagNames: formTagNames,
    },
    source: {
      kind: 'void',
    },
    style: {
      kind: 'raw_text',
    },
    svg: {
      implicitEndingTagNames: breakoutTagNames,
      isImplicitEndingBoundary: true,
      foreignContext: svgOptions,
    },
    table: {
      isImplicitEndingBoundary: true,
    },
    tbody: {
      implicitEndingTagNames: tableSectionTagNames,
    },
    td: {
      implicitEndingTagNames: ['tr', 'th', 'td', ...tableSectionTagNames],
      isImplicitEndingBoundary: true,
    },
    template: {
      isImplicitEndingBoundary: true,
    },
    textarea: {
      kind: 'escapable_raw_text',
      implicitEndingTagNames: formTagNames,
    },
    th: {
      implicitEndingTagNames: ['tr', 'th', 'td', ...tableSectionTagNames],
      isImplicitEndingBoundary: true,
    },
    thead: {
      implicitEndingTagNames: tableSectionTagNames,
    },
    title: {
      kind: 'escapable_raw_text',
    },
    tr: {
      implicitEndingTagNames: ['tr', ...tableSectionTagNames],
    },
    track: {
      kind: 'void',
    },
    ul: {
      isImplicitEndingBoundary: true,
    },
    wbr: {
      kind: 'void',
    },
    xmp: {
      kind: 'raw_text',
    },
  },
  areTagNamesCaseInsensitive: true,
  areUnbalancedStartTagsImplicitlyEnded: true,
  areUnbalancedEndTagsIgnored: true,
  decodeText: decodeHTML,
  decodeAttribute: decodeHTMLAttribute,
};

// Inside SVG and MathML, svg and math don't switch options again, and title is a normal tag rather than escapable raw
// text, since SVG title is an HTML integration point, see
// https://html.spec.whatwg.org/multipage/parsing.html#html-integration-point
const foreignContentTags = {
  ...htmlParserOptions.tags,

  math: {
    implicitEndingTagNames: breakoutTagNames,
    isImplicitEndingBoundary: true,
  },
  svg: {
    implicitEndingTagNames: breakoutTagNames,
    isImplicitEndingBoundary: true,
  },
  title: {
    isImplicitEndingBoundary: true,
  },
};

mathmlOptions.tags = foreignContentTags;

svgOptions.tags = {
  ...foreignContentTags,

  // Content of foreignObject is read as HTML
  foreignObject: {
    isImplicitEndingBoundary: true,
    foreignContext: htmlParserOptions,
  },
};

const htmlSerializerOptions: SerializerOptions = {
  tags: htmlParserOptions.tags,
  areTagNamesCaseInsensitive: true,
  areSelfClosingTagsSupported: false,
  encodeText: escapeXML,
  encodeAttribute: escapeXML,
};

/**
 * Tokenizes HTML markup as a stream of tokens. Never throws, malformed markup is recovered the way browsers do in
 * most cases.
 *
 * @group Tokenizer
 */
export const HTMLTokenizer = createTokenizer(htmlParserOptions);

/**
 * Parses HTML markup as a DOM. Decodes HTML entities in text with
 * [`decodeHTML`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTML.html), and in attribute values with
 * [`decodeHTMLAttribute`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTMLAttribute.html). Never
 * throws, malformed markup is recovered the way browsers do in most cases.
 *
 * @group DOM
 */
export const HTMLDOMParser = createDOMParser(htmlParserOptions);

/**
 * Parses HTML markup and calls {@link SAXHandler} methods when tokens are read. Decodes HTML entities in text with
 * [`decodeHTML`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTML.html), and in attribute values with
 * [`decodeHTMLAttribute`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTMLAttribute.html). Never
 * throws, malformed markup is recovered the way browsers do in most cases.
 *
 * @group SAX
 */
export const HTMLSAXParser = createSAXParser(htmlParserOptions);

/**
 * Serializes a DOM node as an HTML string. Encodes text and attribute values with
 * [`escapeXML`](https://smikhalevski.github.io/speedy-entities/functions/escapeXML.html), except for the content of
 * raw text tags, like `script` and `style`.
 *
 * @group Serializer
 */
export const toHTML = createSerializer(htmlSerializerOptions);
