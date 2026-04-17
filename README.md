<p align="center">
  <a href="#readme"><img alt="TagSoup" src="./assets/logo.png" width="250" /></a>
</p>

TagSoup is [the fastest](#performance) pure JS SAX/DOM XML/HTML parser and serializer.

- Extremely low memory consumption.
- Tolerant of malformed tag nesting, missing end tags, etc.
- Recognizes CDATA sections, processing instructions, and DOCTYPE declarations.
- Supports both strict XML and forgiving HTML parsing modes.
- [20 kB gzipped](https://bundlephobia.com/result?p=tag-soup), including dependencies.
- Check out TagSoup dependencies: [Speedy Entities](https://github.com/smikhalevski/speedy-entities#readme)
  and [Flyweight DOM](https://github.com/smikhalevski/flyweight-dom#readme).

```sh
npm install --save-prod tag-soup
```

- [API docs](https://smikhalevski.github.io/tag-soup/)
- [DOM parsing](#dom-parsing)
- [SAX parsing](#sax-parsing)
- [Tokenization](#tokenization)
- [Serialization](#serialization)
- [Parser options](#parser-options)
- [Performance](#performance)
- [Limitations](#limitations)

# DOM parsing

TagSoup exports preconfigured [`HTMLDOMParser`](https://smikhalevski.github.io/tag-soup/variables/HTMLDOMParser.html)
which parses HTML markup as a DOM node. This parser never throws errors during parsing and forgives malformed markup:

```ts
import { HTMLDOMParser, toHTML } from 'tag-soup';

const fragment = HTMLDOMParser.parseFragment('<p>hello<p>cool</br>');
// ⮕ DocumentFragment

toHTML(fragment);
// ⮕ '<p>hello</p><p>cool<br></p>'
```

`HTMLDOMParser` decodes both HTML entities and numeric character references with
[`decodeHTML`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTML.html).

[`XMLDOMParser`](https://smikhalevski.github.io/tag-soup/variables/XMLDOMParser.html)
parses XML markup as a DOM node. It throws
[`ParserError`](https://smikhalevski.github.io/tag-soup/classes/ParserError.html) if markup doesn't satisfy XML spec:

```ts
import { XMLDOMParser, toXML } from 'tag-soup';

XMLDOMParser.parseFragment('<p>hello</br>');
// ❌ ParserError: Unexpected end tag.

const fragment = XMLDOMParser.parseFragment('<p>hello<br/></p>');
// ⮕ DocumentFragment

toXML(fragment);
// ⮕ '<p>hello<br/></p>'
```

`XMLDOMParser` decodes both XML entities and numeric character references with
[`decodeXML`](https://smikhalevski.github.io/speedy-entities/variables/decodeXML.html).

TagSoup uses [Flyweight DOM](https://github.com/smikhalevski/flyweight-dom#readme) nodes, which provide many standard
DOM manipulation features:

```ts
const document = HTMLDOMParser.parseDocument('<!DOCTYPE html><html>hello</html>');

document.doctype.name;
// ⮕ 'html'

document.textContent;
// ⮕ 'hello'
```

For example, you can use `TreeWalker` to traverse DOM nodes:

```ts
import { TreeWalker, NodeFilter } from 'flyweight-dom';

const fragment = XMLDOMParser.parseFragment('<p>hello<br/></p>');

const treeWalker = new TreeWalker(fragment, NodeFilter.SHOW_TEXT);

treeWalker.nextNode();
// ⮕ Text { 'hello' }
```

Create a custom DOM parser using
[`createDOMParser`](https://smikhalevski.github.io/tag-soup/functions/createDOMParser.html):

```ts
import { createDOMParser } from 'tag-soup';

const myParser = createDOMParser({
  voidTags: ['br'],
});

myParser.parseFragment('<p><br></p>');
// ⮕ DocumentFragment
```

# SAX parsing

TagSoup exports preconfigured [`HTMLSAXParser`](https://smikhalevski.github.io/tag-soup/variables/HTMLSAXParser.html)
which parses HTML markup and calls handler methods when a token is read. This parser never throws errors during parsing
and forgives malformed markup:

```ts
import { HTMLSAXParser } from 'tag-soup';

HTMLSAXParser.parseFragment('<p>hello<p>cool</br>', {
  onStartTagOpening(tagName) {
    // Called with 'p', 'p', and 'br'
  },
  onText(text) {
    // Called with 'hello' and 'cool'
  },
});
```

[`XMLSAXParser`](https://smikhalevski.github.io/tag-soup/variables/XMLSAXParser.html) parses XML markup and calls
handler methods when a token is read. It throws
[`ParserError`](https://smikhalevski.github.io/tag-soup/classes/ParserError.html) if markup doesn't satisfy XML spec:

```ts
import { XMLSAXParser } from 'tag-soup';

XMLSAXParser.parseFragment('<p>hello</br>', {});
// ❌ ParserError: Unexpected end tag.

XMLSAXParser.parseFragment('<p>hello<br/></p>', {
  onEndTag(tagName) {
    // Called with 'br' and 'p'
  },
});
```

Create a custom SAX parser using
[`createSAXParser`](https://smikhalevski.github.io/tag-soup/functions/createSAXParser.html):

```ts
import { createSAXParser } from 'tag-soup';

const myParser = createSAXParser({
  voidTags: ['br'],
});

myParser.parseFragment('<p><br></p>', {
  onStartTagOpening(tagName) {
    // Called with 'p' and 'br'
  },
});
```

## SAX handler callbacks

The [`SAXHandler`](https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html) defines the following optional
callbacks. Implement only the ones you need.

| Callback                  | Description                                    |
| :------------------------ | :--------------------------------------------- |
| `onStartTagOpening`       | A start tag name is read.                      |
| `onAttribute`             | An attribute and its decoded value were read.  |
| `onStartTagClosing`       | A start tag is closed `>`.                     |
| `onStartTagSelfClosing`   | A start tag is self-closed `/>`.               |
| `onStartTag`              | A start tag and its atributes were read.       |
| `onEndTag`                | An end tag matching an open start tag is read. |
| `onText`                  | A decoded text content is read.                |
| `onComment`               | A comment is read.                             |
| `onDoctype`               | A DOCTYPE declaration is read.                 |
| `onCDATASection`          | A CDATA section is read.                       |
| `onProcessingInstruction` | A processing instruction is read.              |

Example using several callbacks at once:

```ts
import { HTMLSAXParser } from 'tag-soup';

HTMLSAXParser.parseFragment('<!-- greeting --><p class="x">hello</p>', {
  onComment(data) {
    // Called with ' greeting '
  },
  onStartTagOpening(tagName) {
    // Called with 'p'
  },
  onAttribute(name, value) {
    // Called with 'class', 'x'
  },
  onStartTagClosing() {
    // Called after all attributes of 'p' are read
  },
  onStartTag(tagName, attributes, isSelfClosing) {
    // Called after onStartTagClosing
  },
  onText(text) {
    // Called with 'hello'
  },
  onEndTag(tagName) {
    // Called with 'p'
  },
});
```

# Tokenization

TagSoup exports preconfigured
[`HTMLTokenizer`](https://smikhalevski.github.io/tag-soup/variables/HTMLSAXParser.html) which parses HTML markup and
invokes a callback when a token is read. This tokenizer never throws errors during tokenization and forgives malformed
markup:

```ts
import { HTMLTokenizer } from 'tag-soup';

HTMLTokenizer.tokenizeFragment('<p>hello<p>cool</br>', (token, startIndex, endIndex) => {
  // Handle token
});
```

[`XMLTokenizer`](https://smikhalevski.github.io/tag-soup/variables/XMLTokenizer.html) parses XML markup and invokes
a callback when a token is read. It throws
[`ParserError`](https://smikhalevski.github.io/tag-soup/classes/ParserError.html) if markup doesn't satisfy XML spec:

```ts
import { XMLTokenizer } from 'tag-soup';

XMLTokenizer.tokenizeFragment('<p>hello</br>', (token, startIndex, endIndex) => {});
// ❌ ParserError: Unexpected end tag.

XMLTokenizer.tokenizeFragment('<p>hello<br/></p>', (token, startIndex, endIndex) => {
  // Handle token
});
```

Create a custom tokenizer using
[`createTokenizer`](https://smikhalevski.github.io/tag-soup/functions/createTokenizer.html):

```ts
import { createTokenizer } from 'tag-soup';

const myTokenizer = createTokenizer({
  voidTags: ['br'],
});

myTokenizer.tokenizeFragment('<p><br></p>', (token, startIndex, endIndex) => {
  // Handle token
});
```

The [`Token`](https://smikhalevski.github.io/tag-soup/types/Token.html) passed to the callback is one of the
following string literals. `startIndex` and `endIndex` are the character positions of the token's value in the input.

| Token                             | Description                                                          |
| :-------------------------------- | :------------------------------------------------------------------- |
| `"TEXT"`                          | Text content between tags.                                           |
| `"START_TAG_NAME"`                | The name portion of an opening tag, e.g. `p` in `<p>`.               |
| `"START_TAG_CLOSING"`             | The `>` that closes an opening tag.                                  |
| `"START_TAG_SELF_CLOSING"`        | The `/>` that self-closes a tag.                                     |
| `"END_TAG_NAME"`                  | The name portion of a closing tag, e.g. `p` in `</p>`.               |
| `"ATTRIBUTE_NAME"`                | An attribute name.                                                   |
| `"ATTRIBUTE_VALUE"`               | A decoded attribute value.                                           |
| `"COMMENT"`                       | Comment content, excluding `<!--` and `-->`.                         |
| `"PROCESSING_INSTRUCTION_TARGET"` | The target of a processing instruction, e.g. `xml` in `<?xml ...?>`. |
| `"PROCESSING_INSTRUCTION_DATA"`   | The data portion of a processing instruction.                        |
| `"CDATA_SECTION"`                 | Content of a CDATA section, excluding `<![CDATA[` and `]]>`.         |
| `"DOCTYPE_NAME"`                  | The name in a DOCTYPE declaration, e.g. `html` in `<!DOCTYPE html>`. |

# Serialization

TagSoup exports two preconfigured serializers:
[`toHTML`](https://smikhalevski.github.io/tag-soup/variables/toHTML.html) and
[`toXML`](https://smikhalevski.github.io/tag-soup/variables/toXML.html).

```ts
import { HTMLDOMParser, toHTML } from 'tag-soup';

const fragment = HTMLDOMParser.parseFragment('<p>hello<p>cool</br>');
// ⮕ DocumentFragment

toHTML(fragment);
// ⮕ '<p>hello</p><p>cool<br></p>'
```

Create a custom serializer using
[`createSerializer`](https://smikhalevski.github.io/tag-soup/functions/createSerializer.html):

```ts
import { HTMLDOMParser, createSerializer } from 'tag-soup';

const mySerializer = createSerializer({
  voidTags: ['br'],
});

const fragment = HTMLDOMParser.parseFragment('<p>hello</br>');
// ⮕ DocumentFragment

mySerializer(fragment);
// ⮕ '<p>hello<br></p>'
```

[`SerializerOptions`](https://smikhalevski.github.io/tag-soup/interfaces/SerializerOptions.html) accepts the
following properties:

| Option                         | Description                                                       |
| :----------------------------- | :---------------------------------------------------------------- |
| `voidTags`                     | Tags that have no content and no closing tag (e.g. `br`, `img`).  |
| `encodeText`                   | Callback to encode text content and attribute values.             |
| `areSelfClosingTags​Supported` | If `true`, void tags are serialized as `<br/>` instead of `<br>`. |
| `areTagNamesCaseInsensitive`   | If `true`, tag name comparisons are case-insensitive.             |

Serialize XML with entity encoding:

```ts
import { XMLDOMParser, createSerializer } from 'tag-soup';
import { encodeXML } from 'speedy-entities';

const toXMLEncoded = createSerializer({
  areSelfClosingTagsSupported: true,
  encodeText: encodeXML,
});

const fragment = XMLDOMParser.parseFragment('<note><text>AT&amp;T</text></note>');

toXMLEncoded(fragment);
// ⮕ '<note><text>AT&amp;T</text></note>'
```

# Parser options

`createDOMParser`, `createSAXParser`, and `createTokenizer` accept a
[`ParserOptions`](https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html) object.

| Option                                     | Description                                                                                                                                                                    |
| :----------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `voidTags`                                 | Tags that have no content and no end tag (e.g. `br`, `img`). See [HTML5 Void Elements](https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#void-elements).                |
| `rawTextTags`                              | Tags whose content is treated as raw text (e.g. `script`, `style`). See [HTML5 Raw Text Elements](https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#raw-text-elements). |
| `decodeText`                               | Callback to decode text content and attribute values (e.g. `decodeHTML` from `speedy-entities`).                                                                               |
| `implicitlyClosedTags`                     | Map from a tag to the list of open tags it implicitly closes. For example `{ h1: ['p'] }` means an opening `<h1>` closes any currently open `<p>`.                             |
| `implicitlyOpenedTags`                     | Tags for which a synthetic start tag is inserted when an unbalanced end tag is encountered (e.g. `['p', 'br']` so `</p>` becomes `<p></p>`).                                   |
| `areTagNames​CaseInsensitive`              | If `true`, tag name comparisons ignore ASCII case.                                                                                                                             |
| `areCDATASections​Recognized`              | If `true`, CDATA sections (`<![CDATA[...]]>`) are recognized.                                                                                                                  |
| `areProcessing​Instruction​Recognized`     | If `true`, processing instructions (`<?target data?>`) are recognized.                                                                                                         |
| `areSelfClosingTags​Recognized`            | If `true`, self-closing tags (`<br/>`) are recognized; otherwise treated as start tags.                                                                                        |
| `isStrict`                                 | If `true`, tag names and attributes are validated against XML constraints.                                                                                                     |
| `areUnbalanced​EndTags​Ignored`            | If `true`, end tags without a matching start tag are silently dropped instead of throwing.                                                                                     |
| `areUnbalanced​StartTags​ImplicitlyClosed` | If `true`, unclosed start tags are forcefully closed at the end of their parent.                                                                                               |

A parser that mimics browser HTML behavior:

```ts
import { createDOMParser } from 'tag-soup';
import { decodeHTML } from 'speedy-entities';

const myParser = createDOMParser({
  voidTags: [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ],
  rawTextTags: ['script', 'style'],
  decodeText,
  areTagNamesCaseInsensitive: true,
  areUnbalancedEndTagsIgnored: true,
  areUnbalancedStartTagsImplicitlyClosed: true,
  implicitlyClosedTags: {
    h1: ['p'],
    h2: ['p'],
    li: ['li'],
    dt: ['dd', 'dt'],
    dd: ['dd', 'dt'],
  },
});
```

# Performance

Execution performance is measured in operations per second (± 5%), the higher number is better.
Memory consumption (RAM) is measured in bytes, the lower number is better.

<table>
<tr>
<th align="right" valign="top" rowspan="2">Library</th>
<th align="right" valign="top" rowspan="2">Library size</th>
<th align="center" colspan="2">DOM parsing</th>
<th align="center" colspan="2">SAX parsing</th>
</tr>

<tr>
<td align="right">Ops/sec</td>
<td align="right">RAM</td>
<td align="right">Ops/sec</td>
<td align="right">RAM</td>
</tr>

<tr>
<td align="right">tag-soup&#x200B;@3.2.1</td>
<td align="right">
<a href="https://bundlephobia.com/package/tag-soup@3.0.0">21 kB</a>
</td>
<td align="right"><strong>35 Hz</strong></td>
<td align="right"><strong>22 MB</strong></td>
<td align="right"><strong>54 Hz</strong></td>
<td align="right"><strong>22 kB</strong></td>
</tr>

<tr>
<td align="right">
<a href="https://github.com/fb55/htmlparser2">htmlparser2</a>&#x200B;@12.0.0
</td>
<td align="right">
<a href="https://bundlephobia.com/package/htmlparser2@12.0.0">34 kB</a>
</td>
<td align="right">15 Hz</td>
<td align="right">35 MB</td>
<td align="right">24 Hz</td>
<td align="right">6 MB</td>
</tr>

<tr>
<td align="right">
<a href="https://github.com/inikulin/parse5">parse5</a>&#x200B;@8.0.0
</td>
<td align="right">
<a href="https://bundlephobia.com/package/parse5@8.0.0">45 kB</a>
</td>
<td align="right">7 Hz</td>
<td align="right">105 MB</td>
<td align="right">11 Hz</td>
<td align="right">10 MB</td>
</tr>

</table>

Performance was measured when parsing [the 3.64 MB HTML file](./src/test/test.html).

Tests were conducted using [TooFast](https://github.com/smikhalevski/toofast#readme) on Apple M1 with Node.js v25.6.0.

To reproduce [the performance test suite](./src/test/perf/overall.perf.js) results, clone this repo and run:

```shell
npm ci
npm run build
npm run perf
```

# Limitations

TagSoup doesn't resolve some quirky element structures that malformed HTML may cause.

Assume the following markup:

<!-- prettier-ignore -->
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
<p>nope</p>
```
