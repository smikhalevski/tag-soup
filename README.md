<p align="center">
  <a href="#readme"><img alt="TagSoup" src="./assets/logo.png" width="250" /></a>
</p>

TagSoup is [the fastest](#performance) pure JS SAX/DOM XML/HTML parser and serializer.

- Extremely low memory consumption.
- Forgiving HTML parsing: recovers from malformed nesting and missing end tags, and ends tags implicitly the way
  browsers do in most cases.
- Strict XML parsing that reports malformed markup with its position.
- Streaming: parses text written in chunks, with the same result as the whole text.
- Recognizes CDATA sections, processing instructions, and DOCTYPE declarations.
- Reads foreign content, like SVG and MathML inside HTML, with its own rules.
- [20 kB gzipped](https://bundlephobia.com/result?p=tag-soup), including dependencies.
- Check out TagSoup dependencies: [Speedy Entities](https://github.com/smikhalevski/speedy-entities#readme) and
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
- [Options](#options)
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

`parseDocument` reads a document: leading spaces are skipped, and a DOCTYPE is recognized before the first tag or text.
`parseFragment` reads a fragment, which has neither. A forgiving parser ignores a DOCTYPE anywhere else.

TagSoup uses [Flyweight DOM](https://github.com/smikhalevski/flyweight-dom#readme) nodes, which provide many standard
DOM manipulation features:

```ts
const document = HTMLDOMParser.parseDocument('<!DOCTYPE html><html>hello</html>');

document.doctype.name;
// ⮕ 'html'

document.documentElement.textContent;
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

`XMLDOMParser` resolves namespaces of elements from `xmlns` and `xmlns:*` attributes:

```ts
import { XMLDOMParser } from 'tag-soup';

const document = XMLDOMParser.parseDocument(
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><xlink:a/></svg>'
);

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
const myParser = createDOMParser({ areNamespacesRecognized: true });
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

XMLSAXParser.parseFragment('<p>hello</br>', {});
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
only the ones you need. Callbacks of a tag are called in this order:

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

XMLTokenizer.tokenizeFragment('<p>hello</br>', tokenHandler);
// ❌ MarkupSyntaxError: Unexpected end tag.

XMLTokenizer.tokenizeFragment('<p>hello<br/></p>', tokenHandler);
```

Create a custom tokenizer with
[`createTokenizer`](https://smikhalevski.github.io/tag-soup/functions/createTokenizer.html):

```ts
import { createTokenizer } from 'tag-soup';

const myTokenizer = createTokenizer({
  tags: { br: { kind: 'void' } },
});

myTokenizer.tokenizeFragment('<p><br></p>', tokenHandler);
```

[`TokenHandler`](https://smikhalevski.github.io/tag-soup/interfaces/TokenHandler.html) has a method per token. All
methods are optional, implement only the ones you need. Indexes passed to a method point to the token in the input:
start indexes are inclusive and end indexes are exclusive.

Tokens are balanced: each start tag is followed by a matching end tag, unless it's self-closing. End tags that the
tokenizer inserts, for void tags and implicitly ended tags, have the start index equal to the end index:

```ts
HTMLTokenizer.tokenizeFragment('<p>hello<p>cool', {
  onEndTagName(input, startIndex, endIndex) {
    // Called with 8, 8 and 15, 15: both p are ended implicitly
  },
});
```

# Streaming

Parsers and tokenizers read text written in chunks, for example from a stream. A token that reaches the end of a chunk
is read when the next chunk is written, and text between tags is passed as a single token, so the result is the same as
if the whole text was parsed at once:

```ts
import { HTMLDOMParser, HTMLSAXParser, toHTML } from 'tag-soup';

const writer = HTMLDOMParser.createDocumentWriter();

writer.write('<p>Hello, ');
writer.write('Bob!');

toHTML(writer.end());
// ⮕ '<p>Hello, Bob!</p>'

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
attribute values with [`escapeXML`](https://smikhalevski.github.io/speedy-entities/functions/escapeXML.html); `toHTML`
writes the content of raw text tags, like `script` and `style`, as is, and writes void tags without end tags, while
`toXML` writes elements without children as self-closing tags:

```ts
import { HTMLDOMParser, toHTML } from 'tag-soup';

toHTML(HTMLDOMParser.parseFragment('<script>if (a < b) {}</script><p title="&quot;">a &amp; b</p>'));
// ⮕ '<script>if (a < b) {}</script><p title="&quot;">a &amp; b</p>'
```

Create a custom serializer with
[`createSerializer`](https://smikhalevski.github.io/tag-soup/functions/createSerializer.html), see
[`SerializerOptions`](https://smikhalevski.github.io/tag-soup/interfaces/SerializerOptions.html) for all options:

```ts
import { HTMLDOMParser, createSerializer } from 'tag-soup';

const mySerializer = createSerializer({
  tags: { br: { kind: 'void' } },
});

mySerializer(HTMLDOMParser.parseFragment('<p>hello</br>'));
// ⮕ '<p>hello<br></p>'
```

Serialize XML with all non-ASCII chars encoded:

```ts
import { encodeXML } from 'speedy-entities';
import { XMLDOMParser, createSerializer } from 'tag-soup';

const toASCIIXML = createSerializer({
  areSelfClosingTagsSupported: true,
  encodeText: encodeXML,
  encodeAttribute: encodeXML,
});

toASCIIXML(XMLDOMParser.parseFragment('<a>caf&#233; &lt;</a>'));
// ⮕ '<a>caf&#xe9; &lt;</a>'
```

A DOCTYPE is written with its public and system identifiers, if it has them.

# Options

Custom parsers, tokenizers and serializers are configured with options, which are described in the API docs:
[`ParserOptions`](https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html),
[`TokenizerOptions`](https://smikhalevski.github.io/tag-soup/interfaces/TokenizerOptions.html),
[`TagParsingOptions`](https://smikhalevski.github.io/tag-soup/interfaces/TagParsingOptions.html) and
[`SerializerOptions`](https://smikhalevski.github.io/tag-soup/interfaces/SerializerOptions.html).

Parser options tell how names, text and attribute values are renamed and decoded:

```ts
import { decodeHTML } from 'speedy-entities';
import { createDOMParser, toHTML } from 'tag-soup';

const myParser = createDOMParser({
  renameTag: name => name.toLowerCase(),
  decodeText: decodeHTML,
});

toHTML(myParser.parseFragment('<B>caf&eacute;</B>'));
// ⮕ '<b>café</b>'
```

Tokenizer options tell what tags can contain, and how they are implicitly ended:

```ts
import { createDOMParser, createTokenizer, toHTML } from 'tag-soup';

const myParser = createDOMParser({
  tokenizer: createTokenizer({
    tags: {
      br: { kind: 'void' },
      li: { implicitEndingTagNames: ['li'] },
      ul: { isImplicitEndingScope: true },
    },
    areUnbalancedEndTagsIgnored: true,
    areUnbalancedStartTagsImplicitlyEnded: true,
  }),
});

toHTML(myParser.parseFragment('<ul><li>one<br><li>two<ul><li>three</ul></ul>'));
// ⮕ '<ul><li>one<br></li><li>two<ul><li>three</li></ul></li></ul>'
```

Options of `HTMLTokenizer` are a complete example, see [html.ts](src/main/html.ts).

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
  error.inputOffset + error.startIndex;
  // ⮕ 8
}
```

`HTMLDOMParser`, `HTMLSAXParser` and `HTMLTokenizer` never throw.

# Cookbook

Collect links with a SAX parser, which doesn't build a DOM:

```ts
import { HTMLSAXParser } from 'tag-soup';

const hrefs: string[] = [];

HTMLSAXParser.parseDocument('<a href="/a">A</a><a href="/b?x=1&amp;y=2">B</a>', {
  onStartTag(tagName, attributes) {
    if (tagName === 'a' && attributes.href !== undefined) {
      hrefs.push(attributes.href);
    }
  },
});

hrefs;
// ⮕ ['/a', '/b?x=1&y=2']
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
  item.setAttribute('class', 'item');
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

Execution performance is measured in operations per second (± 5%), the higher number is better. Memory consumption (RAM)
is measured in bytes, the lower number is better.

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
<td align="right"><strong>44 Hz</strong></td>
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

Performance was measured when parsing [the 3.64 MB HTML file](src/test/test_large.html).

Tests were conducted using [TooFast](https://github.com/smikhalevski/toofast#readme) on Apple M1 with Node.js v25.6.0.

To reproduce [the performance test suite](src/test/perf.ts) results, clone this repo and run:

```shell
npm ci
npm run build
npm run perf
```

# Limitations

TagSoup reads markup in one pass and never moves a node after it was created, so it doesn't implement the tree
construction algorithm of the HTML standard in full:

- `html`, `head`, `body` and `tbody` aren't inserted when they are missing.
- Misnested formatting tags aren't fixed with the adoption agency algorithm, and closed formatting tags aren't reopened.
- Content in a wrong place of a table isn't moved before the table (foster parenting).
- Legacy features such as `frameset`, `plaintext` and quirks mode aren't supported.

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

`HTMLDOMParser` builds the same tree as browsers for 1393 of 1967 tests of the
[html5lib tree construction suite](https://github.com/html5lib/html5lib-tests), when `html`, `head` and `body` are
ignored. Most of the other tests need the algorithms above.
