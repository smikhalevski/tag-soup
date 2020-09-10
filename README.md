# Tag Soup

## SAX Parser


## `createSaxParser`

Creates a SAX parser that:

- Parses XML tags and attributes;
- Parses weird HTML attributes.

### <a id="create-sax-parser-dialect-options"></a>Dialect options

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
If returns `true` than content inside the container tag would be treated as a plain text. Useful when parsing `script` and `style` tags.

### <a id="create-sax-parser-callback-options"></a>Callback options

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




## `createForgivingSaxParser`

Thin wrapper around `createSaxParser` that

- Can handle tags that were closed in incorrect order;
- Adds missing close tags;
- Supports implicit tag closing;
- Supports customizable void tags;

### <a id="create-forgiving-sax-parser-dialect-options"></a>Dialect options

Supports all dialect options from [`createSaxParser`](#create-sax-parser-dialect-options).

**`isVoidContent(tagName)`**
If returns `true` than tag would be treated as self-closing even if it isn't marked up as such.

**`isImplicitEnd(currentTagName, tagName)`**
If returns `true` then `currentTagName` would be closed when `tagName` starts.

### Callback options

Supports all callback options from [`createSaxParser`](#create-sax-parser-callback-options).




## `createHtmlSaxParser`

Preconfigured HTML SAX parser.

### <a id="create-html-sax-parser-dialect-options"></a>Dialect options

**`xhtmlEnabled = false`**
If set to `true` then:
- Self-closing tags are parsed;
- All non-void elements are expected to be closed.

**`strict = false`**
If set to `true` then:
- Doesn't recognize non-terminated and legacy HTML entities;
- Throw an error if decoder meets a disallowed character reference.

**Note:** Using this option may slow parsing because additional checks are involved.

**`replacementChar = "\ufffd"`**
This char is returned for disallowed character references in non-strict mode.

### Callback options

Supports all callback options from [`createSaxParser`](#create-sax-parser-callback-options).




## `createDomParser`

Creates a custom DOM parser that uses provided callbacks to create elements.

### <a id="create-dom-parser-dialect-options"></a>Dialect options

Supports all dialect options from [`createForgivingSaxParser`](#create-forgiving-sax-parser-dialect-options).

**`saxParserFactory`**
Factory that creates an instance of a SAX parser that would be used for actual parsing of the input strings. By
default, a forgiving SAX parser is used.

**Note:** DOM parser expects underlying SAX parser to emit tags in correct order. No additional checks are made while
constructing a tree of elements.

### Factory options

**`createElement(tagName, attrs, selfClosing, start, end)`**
Creates a new element.

**Note:** `attrs` argument is an array-like object that holds pooled objects that would be revoked after this callback
finishes. To preserve parsed attributes make a deep copy of `attrs`. This is done to reduce memory consumption
during parsing by avoiding excessive object allocation.

**`appendChild(element, childNode)`**
Append `childNode` as last child to an `element`.

**`onContainerEnd(data, start, end)`**
Triggered when container element end tag is emitted. Use this to update source end offset of the container element.

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



## `createXmlDomParser`

Preconfigured Cheerio-compatible XML DOM parser.

Supports all dialect options from [`createDomParser`](#create-dom-parser-dialect-options).




## `createHtmlDomParser`

Preconfigured Cheerio-compatible HTML DOM parser. In contrast with `createXmlDomParser` this one knows how to handle HTML void tags and
which HTML tags should be implicitly closed. 

Supports all dialect options from [`createHtmlSaxParser`](#create-html-sax-parser-dialect-options).




## `createEntitiesDecoder`

Creates a decoder callback that would receive a string end decode XML/HTML entities in it.

**`fromCharName(entityName)`**
Receives an entity name ("lt", "gt", etc.) and returns a string replacement for it.

**`fromCharCode(entityCode)`**
Receives a numeric code point and should return a string replacement for it.




## `createFromHtmlCharName`

Creates a mapper from an HTML entity name to a corresponding char.

**`strict = false`**
If set to `true` then:
- Entities that are not terminated with a semicolon are not decoded.

If set to `false` then:
- Legacy HTML entities are decoded even if they are not terminated with a semicolon.




## `createFromCharCode`

Creates a mapper from a numeric XML entity to a corresponding char.

**`strict = false`**
If set to `true` then an error is thrown if decoder meets a disallowed character reference.

**Note:** Using this option may slow decoding because additional checks are involved.

**`replacementChar = "\ufffd"`**
This char is returned for disallowed character references in non-strict mode.




## `fromXmlCharName`

Maps a named XML entity to a corresponding char.
