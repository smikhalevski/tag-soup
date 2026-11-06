import { decodeHTML, escapeXML } from 'speedy-entities';
import { createDOMParser } from './createDOMParser.ts';
import { createSAXParser } from './createSAXParser.ts';
import { createSerializer, type SerializerOptions } from './createSerializer.ts';
import { createTokenizer } from './createTokenizer.ts';
import type { ParserOptions } from './types.ts';

const formTags = ['input', 'option', 'optgroup', 'select', 'button', 'datalist', 'textarea'];

const pTag = ['p'];

const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];

const ddtTags = ['dd', 'dt'];

const rtpTags = ['rt', 'rp'];

const tableSectionTags = ['thead', 'tbody', 'tr', 'th', 'td'];

const htmlParserOptions: ParserOptions = {
  voidTags: [
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
  ],
  rawTextTags: ['script', 'style', 'iframe', 'noembed', 'noframes', 'plaintext'],
  escapableRawTextTags: ['textarea'],
  implicitlyClosedTags: {
    tr: ['tr', 'th', 'td'],
    th: ['th', 'td'],
    td: ['th', 'td'],
    body: ['head', 'link', 'script'],
    a: ['a'],
    li: ['li'],
    p: pTag,
    h1: headingTags,
    h2: headingTags,
    h3: headingTags,
    h4: headingTags,
    h5: headingTags,
    h6: headingTags,
    select: formTags,
    input: formTags,
    output: formTags,
    button: formTags,
    datalist: formTags,
    textarea: formTags,
    option: ['option'],
    optgroup: ['optgroup', 'option'],
    dd: ddtTags,
    dt: ddtTags,
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
    rt: rtpTags,
    rp: rtpTags,
    tbody: tableSectionTags,
    tfoot: tableSectionTags,
  },
  // https://html.spec.whatwg.org/multipage/parsing.html#has-an-element-in-scope
  implicitClosingBoundaryTags: [
    'applet',
    'button',
    'caption',
    'dl',
    'html',
    'marquee',
    'object',
    'ol',
    'table',
    'td',
    'template',
    'th',
    'ul',
  ],
  implicitlyOpenedTags: ['p', 'br'],
  areTagNamesCaseInsensitive: true,
  areUnbalancedStartTagsImplicitlyClosed: true,
  areUnbalancedEndTagsIgnored: true,
  decodeText: decodeHTML,
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
  voidTags: htmlParserOptions.voidTags,
  rawTextTags: htmlParserOptions.rawTextTags,
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
 * Parses HTML markup as DOM. Decodes HTML entities with
 * [`decodeHTML`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTML.html). Never throws, malformed
 * markup is recovered the way browsers do in most cases.
 *
 * @group DOM
 */
export const HTMLDOMParser = createDOMParser(htmlParserOptions);

/**
 * Parses HTML markup and calls {@link SAXHandler} methods when tokens are read. Decodes HTML entities with
 * [`decodeHTML`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTML.html). Never throws, malformed
 * markup is recovered the way browsers do in most cases.
 *
 * @group SAX
 */
export const HTMLSAXParser = createSAXParser(htmlParserOptions);

/**
 * Serializes DOM node as HTML string. Encodes text with
 * [`escapeXML`](https://smikhalevski.github.io/speedy-entities/functions/escapeXML.html), except for the content of
 * raw text tags, like `script` and `style`.
 *
 * @group Serializer
 */
export const toHTML = createSerializer(htmlSerializerOptions);
