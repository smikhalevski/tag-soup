import { decodeHTML, decodeHTMLAttribute, escapeXML } from 'speedy-entities';
import { createDOMParser } from './createDOMParser.ts';
import { createSAXParser } from './createSAXParser.ts';
import { createSerializer, type SerializerOptions } from './createSerializer.ts';
import { createTokenizer } from './createTokenizer.ts';
import type { ParserOptions } from './types.ts';

// Tags that implicitly close form controls
const formTagNames = ['button', 'datalist', 'input', 'output', 'select', 'textarea'];

const headingTagNames = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

const ddtTagNames = ['dd', 'dt'];

const rtpTagNames = ['rt', 'rp'];

const tableSectionTagNames = ['tbody', 'tfoot'];

const htmlParserOptions: ParserOptions = {
  // Scoping tags follow https://html.spec.whatwg.org/multipage/parsing.html#has-an-element-in-scope
  tags: {
    a: { implicitlyClosedBy: ['a'] },
    applet: { isScoping: true },
    area: { kind: 'void' },
    base: { kind: 'void' },
    basefont: { kind: 'void' },
    br: { kind: 'void', isImplicitlyOpened: true },
    button: { implicitlyClosedBy: formTagNames, isScoping: true },
    caption: { isScoping: true },
    col: { kind: 'void' },
    command: { kind: 'void' },
    datalist: { implicitlyClosedBy: formTagNames },
    dd: { implicitlyClosedBy: ddtTagNames },
    dl: { isScoping: true },
    dt: { implicitlyClosedBy: ddtTagNames },
    embed: { kind: 'void' },
    frame: { kind: 'void' },
    h1: { implicitlyClosedBy: headingTagNames },
    h2: { implicitlyClosedBy: headingTagNames },
    h3: { implicitlyClosedBy: headingTagNames },
    h4: { implicitlyClosedBy: headingTagNames },
    h5: { implicitlyClosedBy: headingTagNames },
    h6: { implicitlyClosedBy: headingTagNames },
    head: { implicitlyClosedBy: ['body'] },
    hr: { kind: 'void' },
    html: { isScoping: true },
    iframe: { kind: 'raw_text' },
    img: { kind: 'void' },
    input: { kind: 'void', implicitlyClosedBy: formTagNames },
    isindex: { kind: 'void' },
    keygen: { kind: 'void' },
    li: { implicitlyClosedBy: ['li'] },
    link: { kind: 'void', implicitlyClosedBy: ['body'] },
    marquee: { isScoping: true },
    meta: { kind: 'void' },
    noembed: { kind: 'raw_text' },
    noframes: { kind: 'raw_text' },
    object: { isScoping: true },
    ol: { isScoping: true },
    optgroup: { implicitlyClosedBy: [...formTagNames, 'optgroup'] },
    option: { implicitlyClosedBy: [...formTagNames, 'optgroup', 'option'] },
    p: {
      implicitlyClosedBy: [
        'address',
        'article',
        'aside',
        'blockquote',
        'details',
        'div',
        'dl',
        'fieldset',
        'figcaption',
        'figure',
        'footer',
        'form',
        ...headingTagNames,
        'header',
        'hr',
        'main',
        'nav',
        'ol',
        'p',
        'pre',
        'section',
        'table',
        'ul',
      ],
      isImplicitlyOpened: true,
    },
    param: { kind: 'void' },
    plaintext: { kind: 'raw_text' },
    rp: { implicitlyClosedBy: rtpTagNames },
    rt: { implicitlyClosedBy: rtpTagNames },
    script: { kind: 'raw_text', implicitlyClosedBy: ['body'] },
    select: { implicitlyClosedBy: formTagNames },
    source: { kind: 'void' },
    style: { kind: 'raw_text' },
    table: { isScoping: true },
    tbody: { implicitlyClosedBy: tableSectionTagNames },
    td: { implicitlyClosedBy: ['tr', 'th', 'td', ...tableSectionTagNames], isScoping: true },
    template: { isScoping: true },
    textarea: { kind: 'escapable_raw_text', implicitlyClosedBy: formTagNames },
    th: { implicitlyClosedBy: ['tr', 'th', 'td', ...tableSectionTagNames], isScoping: true },
    thead: { implicitlyClosedBy: tableSectionTagNames },
    tr: { implicitlyClosedBy: ['tr', ...tableSectionTagNames] },
    track: { kind: 'void' },
    ul: { isScoping: true },
    wbr: { kind: 'void' },
  },
  areTagNamesCaseInsensitive: true,
  areUnbalancedStartTagsImplicitlyClosed: true,
  areUnbalancedEndTagsIgnored: true,
  decodeText: decodeHTML,
  decodeAttribute: decodeHTMLAttribute,
};

htmlParserOptions.foreignTags = {
  svg: {
    areCDATASectionsRecognized: true,
    areProcessingInstructionsRecognized: true,
    areSelfClosingTagsRecognized: true,
    foreignTags: {
      foreignObject: htmlParserOptions,
    },
  },
  math: {
    areCDATASectionsRecognized: true,
    areProcessingInstructionsRecognized: true,
    areSelfClosingTagsRecognized: true,
  },
};

const htmlSerializerOptions: SerializerOptions = {
  tags: htmlParserOptions.tags,
  areTagNamesCaseInsensitive: true,
  areSelfClosingTagsSupported: false,
  encodeText: escapeXML,
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
 * Serializes a DOM node as an HTML string. Encodes text with
 * [`escapeXML`](https://smikhalevski.github.io/speedy-entities/functions/escapeXML.html), except for the content of
 * raw text tags, like `script` and `style`.
 *
 * @group Serializer
 */
export const toHTML = createSerializer(htmlSerializerOptions);
