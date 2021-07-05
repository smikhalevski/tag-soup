# TagSoup [![build](https://github.com/smikhalevski/tag-soup/actions/workflows/master.yml/badge.svg?branch=master&event=push)](https://github.com/smikhalevski/tag-soup/actions/workflows/master.yml)

TagSoup is [the fastest](#performance) JS SAX/DOM HTML/XML parser.

## Why use TagSoup?

- [It is the fastest](#performance);
- [It is the tiniest, just 3 kB gzipped](https://bundlephobia.com/result?p=tag-soup) for XML parsing and 16 kB gzipped for HTML parsing;
- Zero dependencies;
- Low memory consumption thanks to object pooling;
- Has streaming support for both SAX and DOM;
- Forgives malformed tag nesting and missing end tags;
- Parses HTML attributes in the same way your browser does;
- Recognizes CDATA, processing instructions, and DOCTYPE;

## Documentation

[API documentation is available here.](https://smikhalevski.github.io/tag-soup/)

Parsing XML SAX
```js
const TagSoup = require('tag-soup');

const parser = TagSoup.createForgivingSaxParser({
  onStartTag(tagName, attrs, selfClosing, start, end) {
    // Process start tag here
  },
  onEndTag(tagName, start, end) {
    // Process end tag here
  },
});
parser.parse('<foo>okay');
```

Parsing XML DOM
```js
const TagSoup = require('tag-soup');

const parser = TagSoup.createXmlDomParser();
const dom = parser.parse('<foo>okay');

console.log(dom[0].children[0].data); // → 'okay'
```

Parsing HTML SAX
```js
const TagSoup = require('tag-soup/lib/html');

const parser = TagSoup.createHtmlSaxParser({
  onStartTag(tagName, attrs, selfClosing, start, end) {
    // Process start tag here
  },
  onEndTag(tagName, start, end) {
    // Process end tag here
  },
});
parser.parse('<script>console.log("<foo></foo>")</script>');
```

Parsing HTML DOM
```js
const TagSoup = require('tag-soup/lib/html');

const parser = TagSoup.createHtmlDomParser();
const dom = parser.parse('<script>console.log("<foo></foo>")</script>');

console.log(dom[0].children[0].data); // → 'console.log("<foo></foo>")'
```

## Performance

SAX parser benchmark
```
createSaxParser      31 ops/sec ±0.54% (277 samples)
createHtmlSaxParser  21 ops/sec ±0.89% (194 samples)
htmlparser2          15 ops/sec ±0.87% (132 samples)
sax                  1 ops/sec ±54.91% (10 samples)

createSaxParser
  2.1✕ faster than htmlparser2
  22.5✕ faster than sax

createHtmlSaxParser
  1.5✕ faster than htmlparser2
  15.8✕ faster than sax
```

DOM parser benchmark
```
createXmlDomParser   7 ops/sec ±59.96% (74 samples)
createHtmlDomParser  8 ops/sec ±51.76% (72 samples)
htmlparser2          4 ops/sec ±59.91% (43 samples)
parse5               1 ops/sec ±56.04% (5 samples)

createXmlDomParser
  1.8✕ faster than htmlparser2
  10.2✕ faster than parse5

createHtmlDomParser
  2.1✕ faster htmlparser2
  12.0✕ faster than parse5
```

To run a performance test use `npm run build` and then `npm run perf`.


## Bundle size

For XML parsing use
```ts
const TagSoup = require('tag-soup');
```  

This would require a 3 kB (gzipped) bundle with: 

- SAX/DOM XML parsing;
- Convenient builder for DOM parsers which allows altering how elements are created;
- Preconfigured Cheerio-compatible XML DOM parser.


For HTML parsing use
```ts
const TagSoup = require('tag-soup/lib/html');
```  

This would require a 16 kB (gzipped) bundle with: 

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
