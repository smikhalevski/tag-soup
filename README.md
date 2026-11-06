<p align="center">
  <a href="#readme"><img alt="TagSoup" src="./assets/logo.png" width="250" /></a>
</p>

TagSoup is [the fastest](#performance) pure JS SAX/DOM XML/HTML parser and serializer.

- Extremely low memory consumption.
- Tolerant of malformed tag nesting, missing end tags, etc.
- Recognizes CDATA sections, processing instructions, and DOCTYPE declarations.
- Supports both strict XML and forgiving HTML parsing modes.
- Parses foreign content, like SVG and MathML inside HTML, with its own rules.
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
- [Error handling](#error-handling)
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
    // Called with 'p', self-closing 'br' has no end tag
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
callbacks. Implement only the ones you need. Callbacks for a tag are called in the order they're listed below.

<dl>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#onstarttagopening"><code>onStartTagOpening(tagName)</code></a></dt>
<dd>A start tag name is read, before its attributes.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#onattribute"><code>onAttribute(name, value)</code></a></dt>
<dd>An attribute is read. The value is decoded, and is an empty string if the attribute has no value.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#onstarttagclosing"><code>onStartTagClosing()</code></a></dt>
<dd>A start tag is closed with <code>&gt;</code>.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#onstarttagselfclosing"><code>onStartTagSelfClosing()</code></a></dt>
<dd>A start tag is closed with <code>/&gt;</code>. Only called if self-closing tags are recognized.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#onstarttag"><code>onStartTag(tagName, attributes, isSelfClosing)</code></a></dt>
<dd>A start tag and all its attributes are read.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#onendtag"><code>onEndTag(tagName)</code></a></dt>
<dd>A tag is closed: by its end tag, implicitly, or right after the start tag of a void tag. Not called for self-closing tags.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#ontext"><code>onText(text)</code></a></dt>
<dd>A text is read. The text is decoded, except inside raw text tags.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#oncomment"><code>onComment(data)</code></a></dt>
<dd>A comment is read.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#ondoctype"><code>onDoctype(name)</code></a></dt>
<dd>A DOCTYPE declaration is read.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#oncdatasection"><code>onCDATASection(data)</code></a></dt>
<dd>A CDATA section is read.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SAXHandler.html#onprocessinginstruction"><code>onProcessingInstruction(target, data)</code></a></dt>
<dd>A processing instruction is read.</dd>
</dl>

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
[`HTMLTokenizer`](https://smikhalevski.github.io/tag-soup/variables/HTMLTokenizer.html) which parses HTML markup and
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
following string literals. `startIndex` and `endIndex` point to the token's value in the input: `startIndex` is
inclusive and `endIndex` is exclusive.

<dl>
<dt><code>"TEXT"</code></dt>
<dd>Text between tags.</dd>
<dt><code>"START_TAG_NAME"</code></dt>
<dd>The tag name in a start tag, <code>p</code> in <code>&lt;p&gt;</code>.</dd>
<dt><code>"START_TAG_CLOSING"</code></dt>
<dd>The <code>&gt;</code> that closes a start tag.</dd>
<dt><code>"START_TAG_SELF_CLOSING"</code></dt>
<dd>The <code>/&gt;</code> that closes a self-closing tag.</dd>
<dt><code>"END_TAG_NAME"</code></dt>
<dd>The tag name in an end tag, <code>p</code> in <code>&lt;/p&gt;</code>.</dd>
<dt><code>"ATTRIBUTE_NAME"</code></dt>
<dd>An attribute name.</dd>
<dt><code>"ATTRIBUTE_VALUE"</code></dt>
<dd>An attribute value without quotes. Tokenizers don't decode entities.</dd>
<dt><code>"COMMENT"</code></dt>
<dd>Comment content between <code>&lt;!--</code> and <code>--&gt;</code>.</dd>
<dt><code>"PROCESSING_INSTRUCTION_TARGET"</code></dt>
<dd>The target of a processing instruction, <code>xml</code> in <code>&lt;?xml version="1.0"?&gt;</code>.</dd>
<dt><code>"PROCESSING_INSTRUCTION_DATA"</code></dt>
<dd>The data of a processing instruction, <code>version="1.0"</code> in <code>&lt;?xml version="1.0"?&gt;</code>.</dd>
<dt><code>"CDATA_SECTION"</code></dt>
<dd>CDATA section content between <code>&lt;![CDATA[</code> and <code>]]&gt;</code>.</dd>
<dt><code>"DOCTYPE_NAME"</code></dt>
<dd>The name in a DOCTYPE declaration, <code>html</code> in <code>&lt;!DOCTYPE html&gt;</code>.</dd>
</dl>

Tokens are balanced: each start tag is followed by a matching end tag. End tags that the tokenizer inserts, for void
tags and implicitly closed tags, have `startIndex` equal to `endIndex`.

Use indices to read token values from the input:

```ts
import { HTMLTokenizer } from 'tag-soup';

const input = '<p class="x">hello</p>';

HTMLTokenizer.tokenizeFragment(input, (token, startIndex, endIndex) => {
  if (token === 'ATTRIBUTE_VALUE') {
    input.substring(startIndex, endIndex);
    // ⮕ 'x'
  }
});
```

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

<dl>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SerializerOptions.html#voidtags"><code>voidTags</code></a></dt>
<dd>Tags that can't have content, like <code>br</code> and <code>img</code>. They are written without an end tag.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SerializerOptions.html#rawtexttags"><code>rawTextTags</code></a></dt>
<dd>Tags whose text content is written without <code>encodeText</code>, like <code>script</code> and <code>style</code>.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SerializerOptions.html#encodetext"><code>encodeText</code></a></dt>
<dd>Encodes text content and attribute values, for example <code>escapeXML</code> from <code>speedy-entities</code>. Comments, CDATA sections and processing instructions are written as is.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SerializerOptions.html#areselfclosingtagssupported"><code>areSelfClosingTagsSupported</code></a></dt>
<dd>If <code>true</code>, elements without children are written as <code>&lt;a/&gt;</code>, otherwise as <code>&lt;a&gt;&lt;/a&gt;</code>. Void tags are always written without an end tag.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/SerializerOptions.html#aretagnamescaseinsensitive"><code>areTagNamesCaseInsensitive</code></a></dt>
<dd>If <code>true</code>, void and raw text tags are matched ignoring ASCII case.</dd>
</dl>

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

[`createDOMParser`](https://smikhalevski.github.io/tag-soup/functions/createDOMParser.html) and
[`createSAXParser`](https://smikhalevski.github.io/tag-soup/functions/createSAXParser.html) accept
[`ParserOptions`](https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html).
[`createTokenizer`](https://smikhalevski.github.io/tag-soup/functions/createTokenizer.html) accepts
[`TokenizerOptions`](https://smikhalevski.github.io/tag-soup/interfaces/TokenizerOptions.html), which are the same options except
`decodeText`.

<dl>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#voidtags"><code>voidTags</code></a></dt>
<dd>Tags that can't have content, like <code>br</code> and <code>img</code>. An end tag is inserted right after the start tag. See <a href="https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#void-elements">HTML5 Void Elements</a>.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#rawtexttags"><code>rawTextTags</code></a></dt>
<dd>Tags whose content is read as text until the matching end tag, like <code>script</code> and <code>style</code>. This text isn't decoded. See <a href="https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#raw-text-elements">HTML5 Raw Text Elements</a>.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#escapablerawtexttags"><code>escapableRawTextTags</code></a></dt>
<dd>Same as <code>rawTextTags</code>, but the text is decoded, like in <code>textarea</code> and <code>title</code>. See <a href="https://www.w3.org/TR/2010/WD-html5-20101019/syntax.html#escapable-raw-text-elements">HTML5 Escapable Raw Text Elements</a>.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#decodetext"><code>decodeText</code></a></dt>
<dd>Decodes text content and attribute values, for example <code>decodeHTML</code> from <code>speedy-entities</code>. Text inside raw text tags, comments, CDATA sections and processing instructions isn't decoded.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#implicitlyclosedtags"><code>implicitlyClosedTags</code></a></dt>
<dd>The map from a tag to tags that it implicitly closes. For example, <code>{ h1: ['p'] }</code> means that <code>&lt;h1&gt;</code> closes an open <code>&lt;p&gt;</code>.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#implicitclosingboundarytags"><code>implicitClosingBoundaryTags</code></a></dt>
<dd>Tags that limit <code>implicitlyClosedTags</code>: tags outside the nearest boundary tag aren't closed. For example, with <code>{ li: ['li'] }</code> and <code>['ul', 'ol']</code>, a nested <code>&lt;li&gt;</code> doesn't close the <code>&lt;li&gt;</code> of the outer list.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#implicitlyopenedtags"><code>implicitlyOpenedTags</code></a></dt>
<dd>Tags for which a start tag is inserted if an unbalanced end tag is read. For example, with <code>['p', 'br']</code>, <code>&lt;/p&gt;</code> becomes <code>&lt;p&gt;&lt;/p&gt;</code>.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#foreigntags"><code>foreignTags</code></a></dt>
<dd>The map from a tag to options that are applied to its attributes and content, like <code>svg</code> and <code>math</code> in HTML. Options are restored when the tag is closed. Foreign tag options can contain <code>foreignTags</code>, <code>areSelfClosingTagsRecognized</code>, <code>areCDATASectionsRecognized</code> and <code>areProcessingInstructionsRecognized</code>.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#areselfclosingtagsrecognized"><code>areSelfClosingTagsRecognized</code></a></dt>
<dd>If <code>true</code>, self-closing tags (<code>&lt;br/&gt;</code>) are recognized, otherwise they are treated as start tags.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#arecdatasectionsrecognized"><code>areCDATASectionsRecognized</code></a></dt>
<dd>If <code>true</code>, CDATA sections (<code>&lt;![CDATA[…]]&gt;</code>) are recognized, otherwise they are treated as comments.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#areprocessinginstructionsrecognized"><code>areProcessingInstructionsRecognized</code></a></dt>
<dd>If <code>true</code>, processing instructions (<code>&lt;?target data?&gt;</code>) are recognized, otherwise they are treated as comments.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#aretagnamescaseinsensitive"><code>areTagNamesCaseInsensitive</code></a></dt>
<dd>If <code>true</code>, ASCII letters in tag names are compared ignoring case.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#areunbalancedstarttagsimplicitlyclosed"><code>areUnbalancedStartTagsImplicitlyClosed</code></a></dt>
<dd>If <code>true</code>, start tags that aren't closed before the end tag of an ancestor, or before the end of the input, are closed implicitly. Otherwise, <code>ParserError</code> is thrown.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#areunbalancedendtagsignored"><code>areUnbalancedEndTagsIgnored</code></a></dt>
<dd>If <code>true</code>, end tags without a matching start tag are ignored. Otherwise, <code>ParserError</code> is thrown.</dd>
<dt><a href="https://smikhalevski.github.io/tag-soup/interfaces/ParserOptions.html#isstrict"><code>isStrict</code></a></dt>
<dd>If <code>true</code>, input must satisfy XML constraints, otherwise <code>ParserError</code> is thrown: tag names, attribute names and processing instruction targets must be valid XML names, attribute values must be in double or single quotes, comments, CDATA sections and processing instructions must be terminated, and a document must have a single root element.</dd>
</dl>

A parser that mimics browser HTML behavior:

```ts
import { createDOMParser, type ParserOptions } from 'tag-soup';
import { decodeHTML } from 'speedy-entities';

const htmlOptions: ParserOptions = {
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
  escapableRawTextTags: ['textarea', 'title'],
  decodeText: decodeHTML,
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
  implicitClosingBoundaryTags: ['ul', 'ol', 'dl', 'table'],
  implicitlyOpenedTags: ['p', 'br'],
};

htmlOptions.foreignTags = {
  svg: {
    areCDATASectionsRecognized: true,
    areProcessingInstructionsRecognized: true,
    areSelfClosingTagsRecognized: true,

    // Content of foreignObject is parsed as HTML again
    foreignTags: { foreignObject: htmlOptions },
  },
  math: {
    areCDATASectionsRecognized: true,
    areProcessingInstructionsRecognized: true,
    areSelfClosingTagsRecognized: true,
  },
};

const myParser = createDOMParser(htmlOptions);
```

# Error handling

Parsers and tokenizers that aren't configured to recover from malformed markup throw
[`ParserError`](https://smikhalevski.github.io/tag-soup/classes/ParserError.html). Its `startIndex` and `endIndex` point to the
malformed part of the `input`:

```ts
import { ParserError, XMLDOMParser } from 'tag-soup';

try {
  XMLDOMParser.parseFragment('<p>hello</br>');
} catch (error) {
  if (error instanceof ParserError) {
    error.message;
    // ⮕ 'Unexpected end tag.'

    error.input.substring(error.startIndex, error.endIndex);
    // ⮕ 'br'
  }
}
```

`HTMLDOMParser`, `HTMLSAXParser` and `HTMLTokenizer` never throw.

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

Performance was measured when parsing [the 3.64 MB HTML file](./src/test/test.html).

Tests were conducted using [TooFast](https://github.com/smikhalevski/toofast#readme) on Apple M1 with Node.js v25.6.0.

To reproduce [the performance test suite](src/test/perf.ts) results, clone this repo and run:

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
