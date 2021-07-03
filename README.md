# TagSoup [![build](https://github.com/smikhalevski/tag-soup/actions/workflows/master.yml/badge.svg?branch=master&event=push)](https://github.com/smikhalevski/tag-soup/actions/workflows/master.yml)

TagSoup is [the fastest](#performance) pure JS SAX/DOM XML/HTML parser.

- [It is the fastest](#performance);
- [It is the tiniest, just 3 kB gzipped](https://bundlephobia.com/result?p=tag-soup) for XML parsing and 16 kB gzipped for HTML parsing;
- Streaming support in both SAX and DOM parsers for XML and HTML; 
- Extremely low memory consumption;
- Forgives malformed tag nesting and missing end tags;
- Parses HTML attributes in the same way your browser does;
- Recognizes CDATA, processing instructions, and DOCTYPE;

```sh
npm install --save-prod @smikhalevski/tiny-router
```

## Documentation

[API documentation is available here.](https://smikhalevski.github.io/tag-soup/)

### XML Streaming

```ts
import * as TagSoup from 'tag-soup';

const xmlParser = TagSoup.createForgivingSaxParser({

  onStartTag(token) {
    console.log(token); // → {name: 'foo', …} 
  },

  onEndTag(token) {
    console.log(token); // → {data: 'okay', …} 
  },
});

xmlParser.parse('<foo>okay');
```

### XML DOM

```ts
import * as TagSoup from 'tag-soup';

const xmlParser = TagSoup.createXmlDomParser();

const domNode = xmlParser.parse('<foo>okay');

console.log(domNode[0].children[0].data); // → 'okay'
```

### HTML Streaming

```ts
import * as TagSoup from 'tag-soup/lib/html';

const htmlParser = TagSoup.createHtmlSaxParser({

  onStartTag(token) {
    console.log(token); // → {name: 'script', …} 
  },

  onEndTag(token) {
    console.log(token); // → {data: 'console.log("<foo></foo>")', …} 
  },
});

htmlParser.parse('<script>console.log("<foo></foo>")</script>');
```

### HTML DOM

```js
import * as TagSoup from 'tag-soup/lib/html';

const htmlParser = TagSoup.createHtmlDomParser();

const domNode = htmlParser.parse('<script>console.log("<foo></foo>")</script>');

console.log(domNode[0].children[0].data); // → 'console.log("<foo></foo>")'
```

## Performance

Performance was measured when parsing [3.81 MB HTML file](./src/test/test.html).

To run a performance test use `npm run build; npm run perf`.

### Streaming

| Parser  | Ops/sec | Samples |
| --- | --- | --- |
| `createSaxParser` | 31 ± 0.54% | 277 |
| `createHtmlSaxParser` | 21 ± 0.89% | 194 |
| [htmlparser2](https://github.com/fb55/htmlparser2) | 15 ± 0.87% | 132 |
| [sax js](https://github.com/isaacs/sax-js) | 1 ± 54.91% | 10 |

### DOM

| Parser  | Ops/sec | Samples |
| --- | --- | --- |
| `createSaxParser` | 7 ± 59.96% | 74 |
| `createHtmlSaxParser` | 8 ± 51.76% | 72 |
| [htmlparser2](https://github.com/fb55/htmlparser2) | 4 ± 59.91% | 43 |
| [Parse5](https://github.com/inikulin/parse5) | 1 ± 56.04% | 5 |


## Bundle size

### XML parsing

```ts
import * as TagSoup from 'tag-soup';
```  

This would require a 3 kB (gzipped) bundle with: 

- SAX/DOM XML parsing;
- Convenient builder for DOM parsers which allows altering how elements are created;
- Preconfigured Cheerio-compatible XML DOM parser.


### HTML parsing

```ts
import * as TagSoup from 'tag-soup/lib/html';
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
