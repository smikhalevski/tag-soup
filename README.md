<p align="center">
  <a href="#readme"><img alt="TagSoup" src="./assets/logo.png" width="250" /></a>
</p>

TagSoup is [the fastest](#performance) pure JS SAX/DOM XML/HTML parser and serializer.

- Extremely low memory consumption.
- Forgiving HTML parsing with [71% browser compatibility](#limitations).
- Strict XML parsing that checks well-formedness constraints.
- Streaming support.
- Recognizes CDATA sections, processing instructions, and DOCTYPE declarations.
- Supports foreign content: SVG and MathML inside HTML.
- Tree-shakeable, [29&#x202F;kB gzipped](https://bundlephobia.com/result?p=tag-soup) including dependencies.
- Built on [Speedy Entities](https://github.com/smikhalevski/speedy-entities#readme) and
  [Flyweight DOM](https://github.com/smikhalevski/flyweight-dom#readme).

<br>

```sh
npm install --save-prod tag-soup
```

<br>

- [API docs](https://smikhalevski.github.io/tag-soup/)
- [DOM parsing](#dom-parsing)
- [SAX parsing](#sax-parsing)
- [Tokenization](#tokenization)
- [Streaming](#streaming)
- [Serialization](#serialization)
- [Error handling](#error-handling)
- [Cookbook](#cookbook)
- [Performance](#performance)
- [Limitations](#limitations)

# DOM parsing

[`HTMLDOMParser`](https://smikhalevski.github.io/tag-soup/variables/HTMLDOMParser.html) parses HTML markup as a DOM. It
never throws and forgives malformed markup:

```ts
import { HTMLDOMParser, toHTML } from 'tag-soup';

const fragment = HTMLDOMParser.parseFragment('<p>hello<p>cool</br>');
// ⮕ DocumentFragment

toHTML(fragment);
// ⮕ '<p>hello</p><p>cool<br></p>'
```

`HTMLDOMParser` decodes HTML character references: in text with
[`decodeHTML`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTML.html), and in attribute values with
[`decodeHTMLAttribute`](https://smikhalevski.github.io/speedy-entities/variables/decodeHTMLAttribute.html). Tag and
attribute names are converted to lower case.

[`XMLDOMParser`](https://smikhalevski.github.io/tag-soup/variables/XMLDOMParser.html) parses XML markup as a DOM. It
throws [`MarkupSyntaxError`](https://smikhalevski.github.io/tag-soup/classes/MarkupSyntaxError.html) if tags aren't
balanced, or markup breaks the
[XML constraints](https://smikhalevski.github.io/tag-soup/interfaces/TokenizerOptions.html#isstrict) that it checks:

```ts
import { XMLDOMParser, toXML } from 'tag-soup';

XMLDOMParser.parseFragment('<p>hello</br>');
// ❌ MarkupSyntaxError: Unexpected end tag.

const fragment = XMLDOMParser.parseFragment('<p>hello<br/></p>');
// ⮕ DocumentFragment

toXML(fragment);
// ⮕ '<p>hello<br/></p>'
```

`XMLDOMParser` decodes XML character references with
[`decodeXML`](https://smikhalevski.github.io/speedy-entities/functions/decodeXML.html).

[`parseDocument`](https://smikhalevski.github.io/tag-soup/interfaces/DOMParser.html#parsedocument) reads a document:
leading spaces are skipped, and a DOCTYPE is recognized before the first tag or text.
[`parseFragment`](https://smikhalevski.github.io/tag-soup/interfaces/DOMParser.html#parsefragment) reads a fragment,
which has neither. A forgiving parser ignores a DOCTYPE anywhere else.

TagSoup uses [Flyweight DOM](https://github.com/smikhalevski/flyweight-dom#readme) nodes, which provide many standard
DOM manipulation features:

```ts
const document = HTMLDOMParser.parseDocument('<!DOCTYPE html><html>hello</html>');

document.doctype.name;
// ⮕ 'html'

document.documentElement.textContent;
// ⮕ 'hello'
```

For example, you can use [`TreeWalker`](https://github.com/smikhalevski/flyweight-dom#traversal) to traverse DOM nodes:

```ts
import { TreeWalker, NodeFilter } from 'flyweight-dom';

const fragment = XMLDOMParser.parseFragment('<p>hello<br/></p>');

const treeWalker = new TreeWalker(fragment, NodeFilter.SHOW_TEXT);

treeWalker.nextNode();
// ⮕ Text { 'hello' }
```

Or use jQuery-style [queries](https://github.com/smikhalevski/flyweight-dom#queries):

```ts
import { $ } from 'flyweight-dom/query';

// The first br inside a p
$(fragment).descendants('p').children('br').nodes;
// ⮕ [Element { 'br' }]
```

Create a custom DOM parser with
[`createDOMParser`](https://smikhalevski.github.io/tag-soup/functions/createDOMParser.html):

```ts
import { createDOMParser, createTokenizer } from 'tag-soup';

const myParser = createDOMParser({
  tokenizer: createTokenizer({
    tags: {
      br: { kind: 'void' },
    },
  }),
});

myParser.parseFragment('<p><br></p>');
// ⮕ DocumentFragment
```

## Namespaces

[`XMLDOMParser`](https://smikhalevski.github.io/tag-soup/variables/XMLDOMParser.html) resolves namespaces of elements
from `xmlns` and `xmlns:*` attributes:

```ts
import { XMLDOMParser } from 'tag-soup';

const document = XMLDOMParser.parseDocument(`
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <xlink:a/>
  </svg>
`);

document.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'svg');
// ⮕ [Element { 'svg' }]

document.getElementsByTagNameNS('http://www.w3.org/1999/xlink', 'a');
// ⮕ [Element { 'xlink:a' }]
```

An element whose prefix isn't declared has no namespace. Attributes that declare namespaces are kept, so
[`getAttributeNS`](https://smikhalevski.github.io/flyweight-dom/classes/flyweight-dom.Element.html#getattributens) and
other namespace-aware methods of an element look up namespaces of attributes.

`HTMLDOMParser` doesn't recognize namespaces. To recognize them in a custom DOM parser, enable
[`areNamespacesRecognized`](https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#arenamespacesrecognized):

```ts
const myParser = createDOMParser({
  areNamespacesRecognized: true,
});
```

# SAX parsing

[`HTMLSAXParser`](https://smikhalevski.github.io/tag-soup/variables/HTMLSAXParser.html) parses HTML markup and calls
handler methods when tokens are read. It never throws and forgives malformed markup:

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

[`XMLSAXParser`](https://smikhalevski.github.io/tag-soup/variables/XMLSAXParser.html) parses XML markup the same way. It
throws [`MarkupSyntaxError`](https://smikhalevski.github.io/tag-soup/classes/MarkupSyntaxError.html) if tags aren't
balanced, or markup breaks the
[XML constraints](https://smikhalevski.github.io/tag-soup/interfaces/TokenizerOptions.html#isstrict) that it checks:

```ts
import { XMLSAXParser } from 'tag-soup';

XMLSAXParser.parseFragment('<p>hello</br>', {/* No handlers */});
// ❌ MarkupSyntaxError: Unexpected end tag.

XMLSAXParser.parseFragment('<p>hello<br/></p>', {
  onEndTag(tagName) {
    // Called with 'p', self-closing 'br' has no end tag
  },
});
```

Create a custom SAX parser with
[`createSAXParser`](https://smikhalevski.github.io/tag-soup/functions/createSAXParser.html):

```ts
import { createSAXParser, createTokenizer } from 'tag-soup';

const myParser = createSAXParser({
  tokenizer: createTokenizer({
    tags: {
      br: { kind: 'void' },
    },
  }),
});

myParser.parseFragment('<p><br></p>', {
  onStartTagOpening(tagName) {
    // Called with 'p' and 'br'
  },
});
```

`XMLSAXParser` resolves namespaces of tags from `xmlns` and `xmlns:*` attributes, and passes them to `onStartTag` and
`onEndTag`:

```ts
XMLSAXParser.parseFragment('<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>', {
  onStartTag(tagName, attributes, isSelfClosing, namespaceURI) {
    // Called with 'svg' and 'circle', both have the namespace 'http://www.w3.org/2000/svg'
  },
});
```

`HTMLSAXParser` doesn't recognize namespaces, and passes `null` instead. To recognize them in a custom SAX parser,
enable
[`areNamespacesRecognized`](https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#arenamespacesrecognized).

All [`SAXHandler`](https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html) callbacks are optional, implement
only the ones you need:

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
    // Called with 'p', { class: 'x' }, false
  },
  onText(text) {
    // Called with 'hello'
  },
  onEndTag(tagName) {
    // Called with 'p'
  },

  // Other handlers go here
});
```

# Tokenization

[`HTMLTokenizer`](https://smikhalevski.github.io/tag-soup/variables/HTMLTokenizer.html) reads HTML markup and passes
tokens to a [`TokenHandler`](https://smikhalevski.github.io/tag-soup/interfaces/TokenHandler.html). Tokens are indexes
in the input, so the tokenizer creates no strings and decodes nothing. It never throws and forgives malformed markup:

```ts
import { HTMLTokenizer } from 'tag-soup';

HTMLTokenizer.tokenizeFragment('<p>hello<p>cool</br>', {
  onText(input, startIndex, endIndex, isRawText) {
    input.substring(startIndex, endIndex);
    // ⮕ 'hello', then 'cool'
  },
});
```

[`XMLTokenizer`](https://smikhalevski.github.io/tag-soup/variables/XMLTokenizer.html) reads XML markup the same way. It
throws [`MarkupSyntaxError`](https://smikhalevski.github.io/tag-soup/classes/MarkupSyntaxError.html) if tags aren't
balanced, or markup breaks the
[XML constraints](https://smikhalevski.github.io/tag-soup/interfaces/TokenizerOptions.html#isstrict) that it checks:

```ts
import { XMLTokenizer } from 'tag-soup';

XMLTokenizer.tokenizeFragment('<p>hello</br>', {/* No handlers */});
// ❌ MarkupSyntaxError: Unexpected end tag.

XMLTokenizer.tokenizeFragment('<p>hello<br/></p>', {/* No handlers */});
```

Create a custom tokenizer with
[`createTokenizer`](https://smikhalevski.github.io/tag-soup/functions/createTokenizer.html):

```ts
import { createTokenizer } from 'tag-soup';

const myTokenizer = createTokenizer({
  tags: {
    br: { kind: 'void' },
  },
});

myTokenizer.tokenizeFragment('<p><br></p>', {/* No handlers */});
```

[`TokenHandler`](https://smikhalevski.github.io/tag-soup/interfaces/TokenHandler.html) has a method per token. All
methods are optional, implement only the ones you need. Indexes passed to a method point to the token in the input:
start indexes are inclusive and end indexes are exclusive.

Tokens are balanced: each start tag is followed by a matching end tag, unless it's self-closing. End tags that the
tokenizer inserts, for void tags and implicitly ended tags, have the start index equal to the end index:

```ts
HTMLTokenizer.tokenizeFragment('<p>hello<p>cool', {
  onEndTagName(input, startIndex, endIndex) {
    // Called with 8, 8 and 15, 15 since both p are ended implicitly
  },
});
```

# Streaming

Parsers and tokenizers read text written in chunks, for example from a stream. A token that reaches the end of a chunk
is read when the next chunk is written, and text between tags is passed as a single token, so the result is the same as
if the whole text was parsed at once:

```ts
import { HTMLDOMParser, HTMLSAXParser, toHTML } from 'tag-soup';

const domWriter = HTMLDOMParser.createDocumentWriter();

domWriter.write('<p>Hello, ');
domWriter.write('Bob!');

const document = domWriter.end();

toHTML(document);
// ⮕ '<p>Hello, Bob!</p>'
```

SAX streaming works the same way:

```ts
const saxWriter = HTMLSAXParser.createFragmentWriter({
  onText(text) {
    // Called with 'Hello' and ' world'
  },
});

saxWriter.write('<b>Hel');
saxWriter.write('lo</b> wor');
saxWriter.end('ld');
```

A tokenizer writer passes tokens with indexes in the part of the stream that it reads now. Add
[`inputOffset`](https://smikhalevski.github.io/tag-soup/interfaces/TokenizerWriter.html#inputoffset) to get indexes in
the whole stream:

```ts
import { XMLTokenizer } from 'tag-soup';

const writer = XMLTokenizer.createFragmentWriter({
  onStartTagName(input, startIndex, endIndex) {
    writer.inputOffset + startIndex;
    // ⮕ 1 for 'aaa', 6 for 'bbb'
  },
});

writer.write('<aaa><b');
writer.write('bb></bbb>');
writer.end('</aaa>');
```

# Serialization

[`toHTML`](https://smikhalevski.github.io/tag-soup/variables/toHTML.html) and
[`toXML`](https://smikhalevski.github.io/tag-soup/variables/toXML.html) serialize DOM nodes. Both escape text and
attribute values with [`escapeXML`](https://smikhalevski.github.io/speedy-entities/functions/escapeXML.html). `toHTML`
writes the content of raw text tags, like `script` and `style`, as is, and writes void tags without end tags, while
`toXML` writes elements without children as self-closing tags:

```ts
import { HTMLDOMParser, toHTML } from 'tag-soup';

const fragment = HTMLDOMParser.parseFragment('<script>if (a < b) {}</script><p title="&quot;">a &amp; b</p>');

toHTML(fragment);
// ⮕ '<script>if (a < b) {}</script><p title="&quot;">a &amp; b</p>'
```

Create a custom serializer with
[`createSerializer`](https://smikhalevski.github.io/tag-soup/functions/createSerializer.html):

```ts
import { HTMLDOMParser, createSerializer } from 'tag-soup';

const mySerializer = createSerializer({
  tags: {
    br: { kind: 'void' },
  },
});

mySerializer(HTMLDOMParser.parseFragment('<p>hello</br>'));
// ⮕ '<p>hello<br></p>'
```

Serialize XML with all non-ASCII chars encoded:

```ts
import { encodeXML } from 'speedy-entities';
import { XMLDOMParser, createSerializer } from 'tag-soup';

const toEncodedXML = createSerializer({
  areSelfClosingTagsSupported: true,
  encodeText: encodeXML,
  encodeAttribute: encodeXML,
});

toEncodedXML(XMLDOMParser.parseFragment('<a>caf&#233; &lt;</a>'));
// ⮕ '<a>caf&#xe9; &lt;</a>'
```

A DOCTYPE is written with its public and system identifiers, if it has them.

# Error handling

Parsers and tokenizers that aren't configured to recover from malformed markup throw
[`MarkupSyntaxError`](https://smikhalevski.github.io/tag-soup/classes/MarkupSyntaxError.html). Its `startIndex` and
`endIndex` point to the malformed part of the `input`:

```ts
import { MarkupSyntaxError, XMLDOMParser } from 'tag-soup';

try {
  XMLDOMParser.parseFragment('<p>hello</br>');
} catch (error) {
  if (error instanceof MarkupSyntaxError) {
    error.message;
    // ⮕ 'Unexpected end tag.'

    error.input.substring(error.startIndex, error.endIndex);
    // ⮕ 'br'
  }
}
```

A writer throws an error whose `input` is the part of the stream that it reads now; `inputOffset + startIndex` is the
index in the whole stream:

```ts
const writer = XMLDOMParser.createFragmentWriter();

try {
  writer.write('<a>xxx');
  writer.write('</b>');
} catch (error) {
  if (error instanceof MarkupSyntaxError) {
    error.inputOffset + error.startIndex;
    // ⮕ 8
  }
}
```

`HTMLDOMParser`, `HTMLSAXParser` and `HTMLTokenizer` never throw.

# Cookbook

Collect links with a SAX parser, which doesn't build a DOM:

```ts
import { HTMLSAXParser } from 'tag-soup';

const hrefs: string[] = [];

HTMLSAXParser.parseDocument('<a href="/hello">Hello</a><a href="/goodbye?x=1&amp;y=2">Goodbye</a>', {
  onStartTag(tagName, attributes) {
    if (tagName === 'a' && attributes.href !== undefined) {
      hrefs.push(attributes.href);
    }
  },
});

hrefs;
// ⮕ ['/hello', '/goodbye?x=1&y=2']
```

Read a DOCTYPE:

```ts
HTMLSAXParser.parseDocument(
  '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">',
  {
    onDoctype(name, publicId, systemId) {
      // Called with 'html', '-//W3C//DTD HTML 4.01//EN', 'http://www.w3.org/TR/html4/strict.dtd'
    },
  }
);
```

Change a DOM and serialize it back:

```ts
import { HTMLDOMParser, toHTML } from 'tag-soup';

const document = HTMLDOMParser.parseDocument('<ul><li>one<li>two</ul>');

for (const item of document.getElementsByTagName('li')) {
  item.classList.add('item');
}

toHTML(document);
// ⮕ '<ul><li class="item">one</li><li class="item">two</li></ul>'
```

Parse a stream of HTML chunks into a DOM:

```ts
import fs from 'node:fs';
import { HTMLDOMParser } from 'tag-soup';

const writer = HTMLDOMParser.createDocumentWriter();

for await (const chunk of fs.createReadStream('index.html', 'utf8')) {
  writer.write(chunk);
}

const document = writer.end();
```

# Performance

TagSoup is up to 5× faster than [htmlparser2](https://github.com/fb55/htmlparser2) and up to 17× faster than
[parse5](https://github.com/inikulin/parse5).

Speed is measured in operations per second (Hz), the higher number is better. The best result of each test is in bold.

<table>
<tr>
<th align="left">Test</th>
<th align="right">tag&#x2011;soup<br>@4.0.0</th>
<th align="right"><a href="https://github.com/fb55/htmlparser2">htmlparser2</a><br>@12.0.0</th>
<th align="right"><a href="https://github.com/inikulin/parse5">parse5</a><br>@8.1.1</th>
<th align="right"><a href="https://github.com/justinwilaby/sax-wasm">sax&#x2011;wasm</a><br>@3.3.0</th>
<th align="right"><a href="https://github.com/taoqf/node-fast-html-parser">node&#x2011;html&#x2011;parser</a><br>@9.0.7</th>
<th align="right"><a href="https://github.com/NaturalIntelligence/fast-xml-parser">fast&#x2011;xml&#x2011;parser</a><br>@5.12.0</th>
<th align="right"><a href="https://github.com/mykolaharmash/hyntax">hyntax</a><br>@1.1.9</th>
</tr>
<tr>
<th colspan="8" align="left">Tokenizer</th>
</tr>
<tr>
<td>&#x2007;&#x2007;HTML,&nbsp;large&nbsp;input&#x202F;¹</td>
<td align="right"><strong>171</strong></td>
<td align="right">67</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td align="right">5</td>
</tr>
<tr>
<th colspan="8" align="left">DOM</th>
</tr>
<tr>
<td>&#x2007;&#x2007;HTML,&nbsp;large&nbsp;input&#x202F;¹</td>
<td align="right"><strong>65</strong></td>
<td align="right">15</td>
<td align="right">8</td>
<td></td>
<td align="right">14</td>
<td></td>
<td></td>
</tr>
<tr>
<td>&#x2007;&#x2007;HTML,&nbsp;large&nbsp;input&#x202F;¹&nbsp;in&nbsp;chunks&#x202F;⁶</td>
<td align="right"><strong>69</strong></td>
<td align="right">15</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr>
<td>&#x2007;&#x2007;HTML,&nbsp;small&nbsp;inputs&#x202F;²</td>
<td align="right"><strong>2,730</strong></td>
<td align="right">821</td>
<td align="right">158</td>
<td></td>
<td align="right">698</td>
<td></td>
<td></td>
</tr>
<tr>
<td>&#x2007;&#x2007;XML,&nbsp;large&nbsp;input&#x202F;³</td>
<td align="right"><strong>99</strong></td>
<td align="right">34</td>
<td></td>
<td></td>
<td></td>
<td align="right">8</td>
<td></td>
</tr>
<tr>
<td>&#x2007;&#x2007;XML,&nbsp;small&nbsp;input&#x202F;⁴</td>
<td align="right"><strong>14,870</strong></td>
<td align="right">3,880</td>
<td></td>
<td></td>
<td></td>
<td align="right">1,650</td>
<td></td>
</tr>
<tr>
<th colspan="8" align="left">SAX</th>
</tr>
<tr>
<td>&#x2007;&#x2007;HTML,&nbsp;large&nbsp;input&#x202F;¹&nbsp;without&nbsp;handlers</td>
<td align="right"><strong>168</strong></td>
<td align="right">24</td>
<td align="right">10&#x202F;⁵</td>
<td align="right">88</td>
<td></td>
<td></td>
<td></td>
</tr>
<tr>
<td>&#x2007;&#x2007;HTML,&nbsp;large&nbsp;input&#x202F;¹</td>
<td align="right"><strong>83</strong></td>
<td align="right">22</td>
<td align="right">10&#x202F;⁵</td>
<td align="right">12</td>
<td></td>
<td></td>
<td></td>
</tr>
<tr>
<td>&#x2007;&#x2007;HTML,&nbsp;large&nbsp;input&#x202F;¹&nbsp;in&nbsp;chunks&#x202F;⁶</td>
<td align="right"><strong>80</strong></td>
<td align="right">24</td>
<td></td>
<td align="right">11</td>
<td></td>
<td></td>
<td></td>
</tr>
<tr>
<td>&#x2007;&#x2007;HTML,&nbsp;small&nbsp;inputs&#x202F;²</td>
<td align="right"><strong>3,040</strong></td>
<td align="right">1,040</td>
<td></td>
<td align="right">512</td>
<td></td>
<td></td>
<td></td>
</tr>
<tr>
<td>&#x2007;&#x2007;XML,&nbsp;small&nbsp;input&#x202F;⁴</td>
<td align="right"><strong>17,070</strong></td>
<td align="right">5,960</td>
<td></td>
<td align="right">2,890</td>
<td></td>
<td></td>
<td></td>
</tr>
<tr>
<th colspan="8" align="left">Serializer</th>
</tr>
<tr>
<td>&#x2007;&#x2007;HTML,&nbsp;large&nbsp;input&#x202F;¹</td>
<td align="right"><strong>78</strong></td>
<td></td>
<td align="right">60</td>
<td></td>
<td align="right">62</td>
<td></td>
<td></td>
</tr>
<tr>
<td>&#x2007;&#x2007;XML,&nbsp;small&nbsp;input&#x202F;⁴</td>
<td align="right"><strong>34,020</strong></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td align="right">6,730</td>
<td></td>
</tr>
</table>

¹ [The 3.64&#x202F;MB HTML file.](src/test/test_large.html)

² 258 pages of [htmlparser-benchmark](https://github.com/AndreasMadsen/htmlparser-benchmark), parsed one by one.

³ [The 2.89&#x202F;MB XML file.](src/test/test_large.xml)

⁴ [The 17.4&#x202F;kB XML file.](src/test/test_small.xml)

⁵ Measured with [parse5-sax-parser](https://github.com/inikulin/parse5/tree/master/packages/parse5-sax-parser)@8.0.1.

⁶ Input is written in chunks of 64&#x202F;kB.

Tests were conducted using [TooFast](https://github.com/smikhalevski/toofast#readme) on Apple M1 with Node.js v26.11.1.

To reproduce [the performance test suite](src/test/perf.ts) results, clone this repo and run:

```shell
npm ci
npm run perf
```

# Limitations

TagSoup reads markup in one pass and never moves a node after it was created, so it doesn't implement the tree
construction algorithm of the HTML standard in full:

- `html`, `head`, `body` and `tbody` aren't inserted when they are missing.
- Misnested formatting tags aren't fixed with the adoption agency algorithm, and closed formatting tags aren't reopened.
- Content in a wrong place of a table isn't moved before the table (foster parenting).
- Legacy features such as `frameset`, `plaintext` and quirks mode aren't supported.

`HTMLDOMParser` builds the same tree as browsers for 1,393 of 1,967 tests (71%) of the
[html5lib tree construction suite](https://github.com/html5lib/html5lib-tests), when `html`, `head` and `body` are
ignored. Most of the other tests need the algorithms above.

For example, assume the following markup:

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
