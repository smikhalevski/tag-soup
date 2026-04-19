import { decodeHTML, escapeXML } from 'speedy-entities';
import type { ParserOptions } from './types.js';
import { createDOMParser } from './createDOMParser.js';
import { createSAXParser } from './createSAXParser.js';
import { createSerializer, type SerializerOptions } from './createSerializer.js';
import { type ContextualTokenizerOptions, createTokenizer } from './createTokenizer.js';

const svgTags = [
  'a',
  'animate',
  'animateMotion',
  'animateTransform',
  'circle',
  'clipPath',
  'defs',
  'desc',
  'ellipse',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
  'filter',
  'foreignObject',
  'g',
  'image',
  'line',
  'linearGradient',
  'marker',
  'mask',
  'metadata',
  'mpath',
  'path',
  'pattern',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'script',
  'set',
  'stop',
  'style',
  'svg',
  'switch',
  'symbol',
  'input',
  'textPath',
  'title',
  'tspan',
  'use',
  'view',
];

const mathTags = [
  'annotation-xml',
  'annotation',
  'maction',
  'math',
  'menclose',
  'merror',
  'mfenced',
  'mfrac',
  'mi',
  'mmultiscripts',
  'mn',
  'mo',
  'mover',
  'mpadded',
  'mphantom',
  'mprescripts',
  'mroot',
  'mrow',
  'ms',
  'mspace',
  'msqrt',
  'mstyle',
  'msub',
  'msubsup',
  'msup',
  'mtable',
  'mtd',
  'mtext',
  'mtr',
  'munder',
  'munderover',
  'semantics',
];

const foreignTags = svgTags.concat(mathTags);

const formTags = ['input', 'option', 'optgroup', 'select', 'button', 'datalist', 'textarea'];

const pTag = ['p'];

const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];

const ddtTags = ['dd', 'dt'];

const rtpTags = ['rt', 'rp'];

const tableSectionTags = ['thead', 'tbody'];

const xmlContextualTokenizerOptions: ContextualTokenizerOptions = {
  areCDATASectionsRecognized: true,
  areProcessingInstructionsRecognized: true,
  areSelfClosingTagsRecognized: true,
};

const htmlContextualTokenizerOptions: ContextualTokenizerOptions = {
  foreignTags: {
    svg: xmlContextualTokenizerOptions,
    math: xmlContextualTokenizerOptions,
  },
};

xmlContextualTokenizerOptions.foreignTags = {
  foreignObject: htmlContextualTokenizerOptions,
};

const htmlParserOptions: ParserOptions = {
  ...htmlContextualTokenizerOptions,
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
    a: ['a'],
    abbr: foreignTags,
    acronym: foreignTags,
    address: pTag.concat(foreignTags),
    area: foreignTags,
    article: pTag.concat(foreignTags),
    aside: pTag.concat(foreignTags),
    audio: foreignTags,
    b: foreignTags,
    base: foreignTags,
    bdi: foreignTags,
    bdo: foreignTags,
    big: foreignTags,
    blockquote: pTag,
    body: ['head', 'link', 'script'].concat(foreignTags),
    br: foreignTags,
    button: formTags.concat(foreignTags),
    canvas: foreignTags,
    caption: foreignTags,
    center: foreignTags,
    cite: foreignTags,
    code: foreignTags,
    col: foreignTags,
    colgroup: foreignTags,
    data: foreignTags,
    datalist: formTags.concat(foreignTags),
    dd: ddtTags.concat(foreignTags),
    del: foreignTags,
    details: pTag.concat(foreignTags),
    dfn: foreignTags,
    dialog: foreignTags,
    dir: foreignTags,
    div: pTag.concat(foreignTags),
    dl: pTag.concat(foreignTags),
    dt: ddtTags.concat(foreignTags),
    em: foreignTags,
    embed: foreignTags,
    fencedframe: foreignTags,
    fieldset: pTag.concat(foreignTags),
    figcaption: pTag.concat(foreignTags),
    figure: pTag.concat(foreignTags),
    font: foreignTags,
    footer: pTag.concat(foreignTags),
    form: pTag.concat(foreignTags),
    frame: foreignTags,
    frameset: foreignTags,
    geolocation: foreignTags,
    h1: headingTags.concat(foreignTags),
    h2: headingTags.concat(foreignTags),
    h3: headingTags.concat(foreignTags),
    h4: headingTags.concat(foreignTags),
    h5: headingTags.concat(foreignTags),
    h6: headingTags.concat(foreignTags),
    head: foreignTags,
    header: pTag.concat(foreignTags),
    hgroup: foreignTags,
    hr: pTag.concat(foreignTags),
    html: foreignTags,
    i: foreignTags,
    iframe: foreignTags,
    img: foreignTags,
    input: formTags.concat(foreignTags),
    ins: foreignTags,
    kbd: foreignTags,
    label: foreignTags,
    legend: foreignTags,
    li: ['li'].concat(foreignTags),
    link: foreignTags,
    main: pTag.concat(foreignTags),
    map: foreignTags,
    mark: foreignTags,
    marquee: foreignTags,
    menu: foreignTags,
    meta: foreignTags,
    meter: foreignTags,
    nav: pTag.concat(foreignTags),
    nobr: foreignTags,
    noembed: foreignTags,
    noframes: foreignTags,
    noscript: foreignTags,
    object: foreignTags,
    ol: pTag.concat(foreignTags),
    optgroup: ['optgroup', 'option'].concat(foreignTags),
    option: ['option'].concat(foreignTags),
    output: formTags.concat(foreignTags),
    p: pTag.concat(foreignTags),
    param: foreignTags,
    picture: foreignTags,
    plaintext: foreignTags,
    pre: pTag.concat(foreignTags),
    progress: foreignTags,
    q: foreignTags,
    rb: foreignTags,
    rp: rtpTags.concat(foreignTags),
    rt: rtpTags.concat(foreignTags),
    rtc: foreignTags,
    ruby: foreignTags,
    s: foreignTags,
    samp: foreignTags,
    script: foreignTags,
    search: foreignTags,
    section: pTag.concat(foreignTags),
    select: formTags.concat(foreignTags),
    selectedcontent: foreignTags,
    slot: foreignTags,
    small: foreignTags,
    source: foreignTags,
    span: foreignTags,
    strike: foreignTags,
    strong: foreignTags,
    style: foreignTags,
    sub: foreignTags,
    summary: foreignTags,
    sup: foreignTags,
    table: pTag.concat(foreignTags),
    tbody: tableSectionTags.concat(foreignTags),
    td: ['thead', 'th', 'td'].concat(foreignTags),
    template: foreignTags,
    textarea: formTags.concat(foreignTags),
    tfoot: tableSectionTags.concat(foreignTags),
    th: ['th', 'td'].concat(foreignTags),
    thead: foreignTags,
    time: foreignTags,
    title: foreignTags,
    tr: ['tr', 'th', 'td'].concat(foreignTags),
    track: foreignTags,
    tt: foreignTags,
    u: foreignTags,
    ul: pTag.concat(foreignTags),
    var: foreignTags,
    video: foreignTags,
    wbr: foreignTags,
    xmp: foreignTags,
  },
  implicitlyOpenedTags: ['p', 'br'],
  foreignTags: {
    svg: {
      areCDATASectionsRecognized: true,
      areProcessingInstructionsRecognized: true,
      areSelfClosingTagsRecognized: true,
      foreignTags: {
        foreignobject: {},
      },
    },
    math: {
      areCDATASectionsRecognized: true,
      areProcessingInstructionsRecognized: true,
      areSelfClosingTagsRecognized: true,
      foreignTags: {
        foreignobject: {},
      },
    },
  },
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
