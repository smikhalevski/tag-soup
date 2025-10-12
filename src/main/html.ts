import { decodeHTML, escapeXML } from 'speedy-entities';
import { ParserOptions } from './types.js';
import { createDOMParser } from './createDOMParser.js';
import { createSAXParser } from './createSAXParser.js';
import { createSerializer, SerializerOptions } from './createSerializer.js';
import { createTokenizer } from './createTokenizer.js';

const formTags = ['input', 'option', 'optgroup', 'select', 'button', 'datalist', 'textarea'];

const pTags = ['p'];

const ddtTags = ['dd', 'dt'];

const rtpTags = ['rt', 'rp'];

const tableTags = ['thead', 'tbody'];

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
  rawTextTags: ['script', 'style', 'textarea'],
  implicitlyClosedTags: {
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
  },
  implicitlyOpenedTags: ['p', 'br'],
  isCaseInsensitiveTags: true,
  isUnbalancedStartTagsImplicitlyClosed: true,
  isUnbalancedEndTagsIgnored: true,
  decodeText: decodeHTML,
};

const htmlSerializerOptions: SerializerOptions = {
  voidTags: htmlParserOptions.voidTags,
  isCaseInsensitiveTags: true,
  isSelfClosingTagsSupported: false,
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
