# TagSoup 🍜 [![build](https://github.com/smikhalevski/tag-soup/actions/workflows/master.yml/badge.svg?branch=master&event=push)](https://github.com/smikhalevski/tag-soup/actions/workflows/master.yml)

TagSoup is [the fastest](#performance) pure JS SAX/DOM XML/HTML parser.

- [It is the fastest](#performance);
- Tiny and tree-shakable, [just 7 kB gzipped](https://bundlephobia.com/result?p=tag-soup), including dependencies;
- Streaming support with SAX and DOM parsers for XML and HTML;
- Extremely low memory consumption;
- Forgives malformed tag nesting and missing end tags;
- Parses HTML attributes in the same way your browser does,
  [see tests for more details](https://github.com/smikhalevski/tag-soup/blob/master/src/test/tokenize.test.ts);
- Recognizes CDATA, processing instructions, and DOCTYPE;

```sh
npm install --save-prod tag-soup
```

# Usage

⚠️ [API documentation is available here.](https://smikhalevski.github.io/tag-soup/)

## SAX

```ts
import {createSaxParser} from 'tag-soup';

// Or use
// import {createXmlSaxParser, createHtmlSaxParser} from 'tag-soup';

const saxParser = createSaxParser({

  startTag(token) {
    console.log(token); // → {tokenType: 1, name: 'foo', …} 
  },

  endTag(token) {
    console.log(token); // → {tokenType: 101, data: 'okay', …} 
  },
});

saxParser.parse('<foo>okay');
```

SAX parser invokes [callbacks during parsing](https://smikhalevski.github.io/tag-soup/interfaces/isaxhandler.html).

Callbacks receive [tokens](https://smikhalevski.github.io/tag-soup/modules.html#token) which represent structures read
from the input. Tokens are pooled objects so when handler callback finishes they are returned to the pool and reused.
Object pooling drastically reduces memory consumption and allows passing a lot of data to the callback.

If you need to retain token after callback finishes use
[`token.clone()`](https://smikhalevski.github.io/tag-soup/interfaces/itoken.html#clone) which returns the deep copy of
the token.

`startTag` and `endTag` callbacks are always invoked in the correct order even if tags in the input were incorrectly
nested or missed.
For [self-closing tags](https://smikhalevski.github.io/tag-soup/interfaces/istarttagtoken.html#selfclosing) only
`startTag` callback in invoked.

### Defaults

All SAX parser factories accept two arguments
[the handler with callbacks](https://smikhalevski.github.io/tag-soup/interfaces/isaxhandler.html) and
[options](https://smikhalevski.github.io/tag-soup/interfaces/iparseroptions.html). The most generic parser factory
[`createSaxParser`](https://smikhalevski.github.io/tag-soup/modules.html#createsaxparser) doesn't have any defaults.

For [`createXmlSaxParser`](https://smikhalevski.github.io/tag-soup/modules.html#createxmlsaxparser) defaults are
[`xmlParserOptions`](https://smikhalevski.github.io/tag-soup/modules.html#xmlparseroptions):

- CDATA sections, processing instructions and self-closing tags are recognized;
- XML entities are decoded in text and attribute values;
- Tag and attribute names are preserved as is;

For [`createHtmlSaxParser`](https://smikhalevski.github.io/tag-soup/modules.html#createhtmlsaxparser) defaults are
[`htmlParserOptions`](https://smikhalevski.github.io/tag-soup/modules.html#htmlparseroptions):

- CDATA sections and processing instructions are treated as comments;
- Self-closing tags are treated as a start tags;
- Tags like `p`, `li`, `td` and others follow implicit end rules, so `<p>foo<p>bar` is parsed as `<p>foo</p><p>bar</p>`;
- Tag and attribute names are converted to lower case;
- Legacy HTML entities are decoded in text and attribute values.

You can alter how the parser works
[through options](https://smikhalevski.github.io/tag-soup/interfaces/iparseroptions.html) which give you fine-grained
control over parsing dialect.

By default, TagSoup uses [`speedy-entites`](https://github.com/smikhalevski/speedy-entities#readme) to decode XML and HTML
entities. Parser created by `createHtmlSaxParser` decodes only legacy HTML entities. This is done to reduce the bundle
size.

To decode [all HTML entities](https://en.wikipedia.org/wiki/List_of_XML_and_HTML_character_entity_references) use this
snippet below. It would add 10 kB gzipped to the bundle size.

```ts
import {decodeHtml} from 'speedy-entities/lib/full';

const htmlParser = createHtmlSaxParser({
  decodeText: decodeHtml,
  decodeAttribute: decodeHtml,
});
```

With `speedy-entites` you can create [a custom decoder](https://github.com/smikhalevski/speedy-entities#custom-decoders)
that would recognize custom entities.

<details>
<summary>The list of legacy HTML entities</summary>
<p>

> `aacute` `Aacute` `acirc` `Acirc` `acute` `aelig` `AElig` `agrave` `Agrave` `amp` `AMP` `aring` `Aring` `atilde`
> `Atilde` `auml` `Auml` `brvbar` `ccedil` `Ccedil` `cedil` `cent` `copy` `COPY` `curren` `deg` `divide` `eacute`
> `Eacute` `ecirc` `Ecirc` `egrave` `Egrave` `eth` `ETH` `euml` `Euml` `frac12` `frac14` `frac34` `gt` `GT` `iacute`
> `Iacute` `icirc` `Icirc` `iexcl` `igrave` `Igrave` `iquest` `iuml` `Iuml` `laquo` `lt` `LT` `macr` `micro` `middot`
> `nbsp` `not` `ntilde` `Ntilde` `oacute` `Oacute` `ocirc` `Ocirc` `ograve` `Ograve` `ordf` `ordm` `oslash` `Oslash`
> `otilde` `Otilde` `ouml` `Ouml` `para` `plusmn` `pound` `quot` `QUOT` `raquo` `reg` `REG` `sect` `shy` `sup1` `sup2`
> `sup3` `szlig` `thorn` `THORN` `times` `uacute` `Uacute` `ucirc` `Ucirc` `ugrave` `Ugrave` `uml` `uuml` `Uuml`
> `yacute` `Yacute` `yen` `yuml`

</p>
</details>

### Streaming

SAX parsers support streaming. You can use
[`saxParser.write(chunk)`](https://smikhalevski.github.io/tag-soup/interfaces/iparser.html#write) to parse input data
chunk by chunk.

```ts
const saxParser = createSaxParser({/*callbacks*/});

saxParser.write('<foo>ok');
// Triggers startTag callabck for "foo" tag.

saxParser.write('ay');
// Doesn't trigger any callbacks.

saxParser.write('</foo>');
// Triggers text callback for "okay" and endTag callback for "foo" tag.
```

## DOM

```ts
import {createDomParser} from 'tag-soup';

// Or use
// import {createXmlDomParser, createHtmlDomParser} from 'tag-soup';

// Minimal DOM handler example
const domParser = createDomParser<any>({

  element(token) {
    return {tagName: token.name, children: []};
  },

  appendChild(parentNode, node) {
    parentNode.children.push(node);
  },
});

const domNode = domParser.parse('<foo>okay');

console.log(domNode[0].children[0].data); // → 'okay'
```

DOM parser assembles a node three using a
[handler](https://smikhalevski.github.io/tag-soup/interfaces/idomhandler.html) that describes how nodes are created and
appended.

The generic parser factory [`createDomParser`](https://smikhalevski.github.io/tag-soup/modules.html#createdomparser)
requires a [handler](https://smikhalevski.github.io/tag-soup/interfaces/idomhandler.html) to be provided.

Both [`createXmlDomParser`](https://smikhalevski.github.io/tag-soup/modules.html#createxmldomparser) and
[`createHtmlDomParser`](https://smikhalevski.github.io/tag-soup/modules.html#createhtmldomparser) use
[`domHandler`](https://smikhalevski.github.io/tag-soup/modules.html#domhandler) if no other handler was provided and use
default options ([`xmlParserOptions`](https://smikhalevski.github.io/tag-soup/modules.html#xmlparseroptions)
and [`htmlParserOptions`](https://smikhalevski.github.io/tag-soup/modules.html#htmlparseroptions) respectively) which
[can be overridden](https://smikhalevski.github.io/tag-soup/interfaces/iparseroptions.html).

### Streaming

DOM parsers support streaming. You can use
[`domParser.write(chunk)`](https://smikhalevski.github.io/tag-soup/interfaces/iparser.html#write) to parse input data
chunk by chunk.

```ts
const domParser = createXmlDomParser();

domParser.write('<foo>ok');
// → [{nodeType: 1, tagName: 'foo', children: [], …}]

domParser.write('ay');
// → [{nodeType: 1, tagName: 'foo', children: [], …}]

domParser.write('</foo>');
// → [{nodeType: 1, tagName: 'foo', children: [{nodeType: 3, data: 'okay', …}], …}]
```

# Performance

[To run a performance test](./src/test/perf.js) use `npm ci && npm run build && npm run perf`.

## Large input

Performance was measured when parsing [the 3.81 MB HTML file](./src/test/test.html).

Results are in operations per second. The higher number is better.

### SAX benchmark

|  | Ops/sec |
| --- | ---: |
| `createSaxParser` ¹ | 36.3 ± 0.8% |
| `createXmlSaxParser` ¹ | 30.7 ± 0.5% |
| `createHtmlSaxParser` ¹ | 23.7 ± 0.5% |
| `createSaxParser` | 29.2 ± 0.5% |
| `createXmlSaxParser` | 26.1 ± 0.5% |
| `createHtmlSaxParser` | 19.9 ± 0.5% |
| [`@fb55/htmlparser2`](https://github.com/fb55/htmlparser2) | 14.3 ± 0.5% |
| [`@isaacs/sax-js`](https://github.com/isaacs/sax-js) | 1.7 ± 4.6% |

¹ Parsers were provided a handler with a single
[`text`](https://smikhalevski.github.io/tag-soup/interfaces/isaxhandler.html#text) callback. This configuration can be
useful if you want to strip tags from the input.

### DOM benchmark

|  | Ops/sec |
| --- | ---: |
| `createDomParser` | 13.7 ± 0.5% |
| `createXmlDomParser` | 12.6 ± 0.5% |
| `createHtmlDomParser` | 10.6 ± 0.5% |
| [`@fb55/htmlparser2`](https://github.com/fb55/htmlparser2) | 8.4 ± 0.5% |
| [`@inikulin/parse5`](https://github.com/inikulin/parse5) | 2.8 ± 0.7% |

## Small input

The performance was measured when parsing
[258 files with 95 kB in size on average](https://github.com/AndreasMadsen/htmlparser-benchmark/tree/master/files) from
[`htmlparser-benchmark`](https://github.com/AndreasMadsen/htmlparser-benchmark).

Results are in operations per second. The higher number is better.

### SAX benchmark

|  | Ops/sec |
| --- | ---: |
| `createSaxParser` | 1 998.0 ± 0.1% |
| `createXmlSaxParser` | 1 734.1 ± 0.1% |
| `createHtmlSaxParser` | 1 285.4 ± 0.1% |
| [`@fb55/htmlparser2`](https://github.com/fb55/htmlparser2) | 717.5 ± 0.2% |

### DOM benchmark

|  | Ops/sec |
| --- | ---: |
| `createDomParser` | 1 087.1 ± 0.2% |
| `createXmlDomParser` | 853.5 ± 0.2% |
| `createHtmlDomParser` | 668.0 ± 0.2% |
| [`@fb55/htmlparser2`](https://github.com/fb55/htmlparser2) | 457.7 ± 0.2% |
| [`@inikulin/parse5`](https://github.com/inikulin/parse5) | 50.8 ± 0.4% |

# Limitations

TagSoup doesn't resolve some weird element structures that malformed HTML may cause.

For example, assume the following markup:

```html
<p><strong>okay
<p>nope
``` 

With [`DOMParser`](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser) this markup would be transformed to:

```html
<p><strong>okay</strong></p>
<p><strong>nope</strong></p>
``` 

TagSoup doesn't insert the second `strong` tag:

```html
<p><strong>okay</strong></p>
<p>nope</p> <!-- Note the absent "strong" tag  -->
``` 
