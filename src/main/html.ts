import { decodeHTML, escapeXML } from 'speedy-entities';
import type { ParserOptions } from './types.js';
import { createDOMParser } from './createDOMParser.js';
import { createSAXParser } from './createSAXParser.js';
import { createSerializer, type SerializerOptions } from './createSerializer.js';
import { createTokenizer } from './createTokenizer.js';

const formTags = ['input', 'option', 'optgroup', 'select', 'button', 'datalist', 'textarea'];

const pTag = ['p'];

const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];

const ddtTags = ['dd', 'dt'];

const rtpTags = ['rt', 'rp'];

const tableSectionTags = ['thead', 'tbody'];

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
  rawTextTags: ['script', 'style', 'textarea', 'iframe', 'noembed', 'noframes', 'plaintext'],
  implicitlyClosedTags: {
    tr: ['tr', 'th', 'td'],
    th: ['th', 'td'],
    td: ['thead', 'th', 'td'],
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
  implicitlyOpenedTags: ['p', 'br'],
  areTagNamesCaseInsensitive: true,
  areUnbalancedStartTagsImplicitlyClosed: true,
  areUnbalancedEndTagsIgnored: true,
  decodeText: decodeHTML,
};

const htmlSerializerOptions: SerializerOptions = {
  voidTags: htmlParserOptions.voidTags,
  areTagNamesCaseInsensitive: true,
  areSelfClosingTagsSupported: false,
  encodeText: escapeXML,
};

/**
 * Tokenizes HTML markup as a stream of tokens.
 *
 * @group Tokenizer
 */
export const HTMLTokenizer = createTokenizer(htmlParserOptions);

/**
 * Parses HTML markup as DOM.
 *
 * @group DOM
 */
export const HTMLDOMParser = createDOMParser(htmlParserOptions);

/**
 * Parses HTML markup as a stream of tokens.
 *
 * @group SAX
 */
export const HTMLSAXParser = createSAXParser(htmlParserOptions);

/**
 * Serializes DOM node as HTML string.
 *
 * @group DOM
 */
export const toHTML = createSerializer(htmlSerializerOptions);
