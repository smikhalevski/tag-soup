# TagSoup

> The fastest JS SAX/DOM HTML/XML parser.

## Why use TagSoup?

- It is the fastest;
- It is the tiniest, just 3 KB gzipped for XML parsing and 16 KB gzipped for HTML parsing;
- Zero dependencies;
- Low memory consumption thanks to object pooling;
- Has streaming support for both SAX and DOM;
- Forgives malformed tag nesting and missing end tags;
- Parses HTML attributes in the same way your browser does;
- Recognizes CDATA, processing instructions, and DOCTYPE;

## Performance

SAX parser benchmark
```
createSaxParser      31 ops/sec ±0.55% (278 samples)
createHtmlSaxParser  22 ops/sec ±0.66% (198 samples)
htmlparser2          15 ops/sec ±0.7% (134 samples)
sax                  1 ops/sec ±52.95% (10 samples)

htmlparser2
  2.1✕ slower than createSaxParser
  1.5✕ slower than createHtmlSaxParser

sax
  21.8✕ slower than createSaxParser
  15.4✕ slower than createHtmlSaxParser
```

DOM parser benchmark
```
createXmlDomParser   7 ops/sec ±61.11% (73 samples)
createHtmlDomParser  8 ops/sec ±51.76% (72 samples)
htmlparser2          4 ops/sec ±61.31% (43 samples)
parse5               1 ops/sec ±52.56% (5 samples)

htmlparser2
  1.7✕ slower than createXmlDomParser
  2.0✕ slower than createHtmlDomParser

parse5
  11.2✕ slower than createXmlDomParser
  13.5✕ slower than createHtmlDomParser
```

You can run a performance test using `npm i; npm run build; npm run perf`.


## Bundle size

For XML parsing use:

```ts
const TagSoup = require('tag-soup');
```  

This would require a 3 KB (gzipped) bundle with: 

- SAX/DOM XML parsing;
- Convenient builder for DOM parsers which allows altering how elements are created;
- Preconfigured Cheerio-compatible XML DOM parser.


For HTML parsing use:

```ts
const TagSoup = require('tag-soup/lib/html');
```  

This would require a 16 KB (gzipped) bundle with: 

- Everything from XML bundle;
- Support of implicit void tags like `<img>`;
- Support all HTML entities (even legacy ones);
- Decode complex codepoints in numeric XML entities;
- Support implicit tag closing in TagSoup (like for `<p>foo<p>bar` which is `<p>foo</p><p>bar</p>`);
- Preconfigured Cheerio-compatible HTML DOM parser.



## Limitations

Considering XML, TagSoup has no limitations and can parse any XML document.

At the same time, TagSoup isn't a full-blown HTML DOM parser like in-browser `DOMParser` or [Parse5](https://github.com/inikulin/parse5). It doesn't resolve all weird element structures that malformed HTML may cause.

For example, assume the following markup
```html
<p><b>okay
<p>nope
``` 
with Parse5 you would get the following HTML
```html
<p><b>okay</b></p>
<p><b>nope</b></p>
``` 
while with TagSoup you would get
```html
<p><b>okay</b></p>
<p>nope</p>
``` 
note the missing `b` tag in the second paragraph.

TagSoup can parse all weird attribute syntax variations and any tag names, [see tests here for more details](https://github.com/smikhalevski/tag-soup/blob/master/src/test/createSaxParser.test.ts).



## Usage examples

XML parsing:
```js
const TagSoup = require('tag-soup');

const parser = TagSoup.createXmlDomParser();
const dom = parser.commit('<foo>okay');

console.log(dom[0].children[0].data); // → 'okay'
```

HTML DOM parsing:
```js
const TagSoup = require('tag-soup/lib/html');

const parser = TagSoup.createHtmlDomParser();
const dom = parser.commit('<script>console.log("<foo></foo>")</script>');

console.log(dom[0].children[0].data); // → 'console.log("<foo></foo>")'
```



## API

### Parsers

Both SAX and DOM parsers are stateful instances that have the following methods:

**writeStream(chunk)**
Makes parser process a given string chunk and triggers corresponding callbacks. If there's an ambiguity during parsing then the parser is paused until the next `writestream` invocation in order to resolve it when additional data is available.

**commit(chunk)**
Makes parser process a given string chunk and triggers corresponding callbacks. Always parses the whole string.

**resetStream()**
Resets the internal state of the parser.


### `createSaxParser`

Creates a SAX parser that:

- Parses XML tags and attributes;
- Parses weird HTML attributes.

#### <a id="create-sax-parser-dialect-options"></a>Dialect options

**`xmlEnabled = false`**
If set to `true` then
- CDATA sections, processing instructions are parsed;
- Self-closing tags are recognized;
- Tag names are case-sensitive.
 
If set to `false` then
- CDATA sections and processing instructions are emitted as comments;
- Self-closing tags are treated as start tags;
- Tag names are case-insensitive.

**`decodeAttr(attrValue)`**
Receives attribute value and returns string with decoded entities. By default, only XML entities are decoded.

**`decodeText(textData)`**
Receives text node value and returns string with decoded entities. By default, only XML entities are decoded.

**`renameTag(tagName)`**
Rewrites tag name. By default, in XML mode tags aren't renamed while in non-XML mode tags are converted to lower case.

**`renameAttr(attrName)`**
Rewrites attribute name. By default, there's no renaming.

**`selfClosingEnabled = false`**
Enables self-closing tags recognition. In XML mode this is always enabled.

**`isTextContent(tagName)`**
If returns `true` than the content inside the container tag would be treated as a plain text. Useful when parsing `script` and `style` tags.

#### <a id="create-sax-parser-callback-options"></a>Callback options

**`onStartTag(tagName, attrs, selfClosing, start, end)`**
Triggered when a start tag and its attributes were read.

**Note:** `attrs` argument is an array-like object that holds pooled objects that would be revoked after this callback finishes. To preserve parsed attributes make a deep copy of `attrs`. Object pooling is used to reduce memory consumption during parsing by avoiding excessive allocations.

**`onEndTag(tagName, start, end)`**
Triggered when an end tag was read.

**`onText(data, start, end)`**
Triggered when a chunk of text was read.

**`onComment(data, start, end)`**
Triggered when a comment was read.

**`onProcessingInstruction(data, start, end)`**
Triggered when a processing instruction was read.

**`onCdataSection(data, start, end)`**
Triggered when a CDATA section was read. This is triggered only when `xmlEnabled` is set to `true`. In HTML mode CDATA sections are treated as text.

**`onDocumentType(data, start, end)`**
Triggered when a DOCTYPE was read. This library doesn't process the contents of the DOCTYPE and `data` argument would contain the raw source of the DOCTYPE declaration. 

**`onReset()`**
Triggered when `saxParser.resetStream()` is called.

**`onWrite(chunk, parsedCharCount)`**
Triggered when `saxParser.writeStream(chunk)` is called.

**`onCommit(chunk, parsedCharCount)`**
Triggered when `saxParser.commit(chunk)` is called.




### `createForgivingSaxParser`

A thin wrapper around `createSaxParser` that

- Can handle tags that were closed in incorrect order;
- Adds missing close tags;
- Supports implicit tag closing;
- Supports customizable void tags;

#### <a id="create-forgiving-sax-parser-dialect-options"></a>Dialect options

Supports all dialect options from [`createSaxParser`](#create-sax-parser-dialect-options).

**`isVoidContent(tagName)`**
If returns `true` than the tag would be treated as self-closing even if it isn't marked up as such.

**`isImplicitEnd(currentTagName, tagName)`**
If returns `true` then `currentTagName` would be closed when `tagName` starts.

#### Callback options

Supports all callback options from [`createSaxParser`](#create-sax-parser-callback-options).




### `createHtmlSaxParser`

Preconfigured HTML SAX parser.

#### <a id="create-html-sax-parser-dialect-options"></a>Dialect options

**`xhtmlEnabled = false`**
If set to `true` then:
- Self-closing tags are parsed;
- All non-void elements are expected to be closed.

**`strict = false`**
If set to `true` then:
- Doesn't recognize non-terminated and legacy HTML entities;
- Throw an error if the decoder meets a disallowed character reference.

**Note:** Using this option may slow parsing because additional checks are involved.

**`replacementChar = "\ufffd"`**
This char is returned for disallowed character references in non-strict mode.

#### Callback options

Supports all callback options from [`createSaxParser`](#create-sax-parser-callback-options).




### `createDomParser`

Creates a custom DOM parser that uses provided callbacks to create elements.

#### <a id="create-dom-parser-dialect-options"></a>Dialect options

Supports all dialect options from [`createForgivingSaxParser`](#create-forgiving-sax-parser-dialect-options).

**`saxParserFactory`**
The factory that creates an instance of a SAX parser that would be used for actual parsing of the input strings. By default, a forgiving SAX parser is used.

**Note:** DOM parser expects underlying SAX parser to emit tags in the correct order. No additional checks are made while constructing a tree of elements.

#### Factory options

**`createElement(tagName, attrs, selfClosing, start, end)`**
Creates a new element.

**Note:** `attrs` argument is an array-like object that holds pooled objects that would be revoked after this callback finishes. To preserve parsed attributes make a deep copy of `attrs`. This is done to reduce memory consumption during parsing by avoiding excessive object allocation.

**`appendChild(element, childNode)`**
Append `childNode` as the last child to an `element`.

**`onContainerEnd(data, start, end)`**
Triggered when the container element end tag is emitted. Use this to update the source end offset of the container element.

**`createTextNode(data, start, end)`**
Creates a new text node.

**`createProcessingInstruction(data, start, end)`**
Creates a new processing instruction.

**`createCdataSection(data, start, end)`**
Creates a new CDATA section node.

**`createDocumentType(data, start, end)`**
Creates a new DOCTYPE node.

**`createComment(data, start, end)`**
Creates a new comment node.



### `createXmlDomParser`

Preconfigured Cheerio-compatible XML DOM parser.

Supports all dialect options from [`createDomParser`](#create-dom-parser-dialect-options).




### `createHtmlDomParser`

Preconfigured Cheerio-compatible HTML DOM parser. In contrast with `createXmlDomParser` this one knows how to handle HTML void tags and which HTML tags should be implicitly closed.

Supports all dialect options from [`createHtmlSaxParser`](#create-html-sax-parser-dialect-options).




### `createEntitiesDecoder`

Creates a decoder callback that would receive a string end decode XML/HTML entities in it.

**`fromCharName(entityName)`**
Receives an entity name ("lt", "gt", etc.) and returns a string replacement for it.

**`fromCharCode(entityCode)`**
Receives a numeric code point and should return a string replacement for it.




### `createFromHtmlCharName`

Creates a mapper from an HTML entity name to a corresponding char.

**`strict = false`**
If set to `true` then:
- Entities that are not terminated with a semicolon are not decoded.

If set to `false` then:
- Legacy HTML entities are decoded even if they are not terminated with a semicolon.




### `createFromCharCode`

Creates a mapper from a numeric XML entity to a corresponding char.

**`strict = false`**
If set to `true` then an error is thrown if the decoder meets a disallowed character reference.

**Note:** Using this option may slow decoding because additional checks are involved.

**`replacementChar = "\ufffd"`**
This char is returned for disallowed character references in non-strict mode.




### `fromXmlCharName`

Maps a named XML entity to a corresponding char.
