# TagSoup [![build](https://github.com/smikhalevski/tag-soup/actions/workflows/master.yml/badge.svg?branch=master&event=push)](https://github.com/smikhalevski/tag-soup/actions/workflows/master.yml)

TagSoup is [the fastest](#performance) pure JS SAX/DOM XML/HTML parser.

- [It is the fastest](#performance);
- [It is the tiniest, just 3 kB gzipped](https://bundlephobia.com/result?p=tag-soup) for XML parsing and 16 kB gzipped
  for HTML parsing;
- Streaming support in both SAX and DOM parsers for XML and HTML;
- Extremely low memory consumption;
- Forgives malformed tag nesting and missing end tags;
- Parses HTML attributes in the same way your browser does;
- Recognizes CDATA, processing instructions, and DOCTYPE;

```sh
npm install --save-prod tag-soup
```

## Documentation

[Full API documentation.](https://smikhalevski.github.io/tag-soup/)

### XML Streaming

```ts
import * as TagSoup from 'tag-soup';

const xmlParser = TagSoup.createForgivingSaxParser({

  startTag(token) {
    console.log(token); // → {name: 'foo', …} 
  },

  endTag(token) {
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

  startTag(token) {
    console.log(token); // → {name: 'script', …} 
  },

  endTag(token) {
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

Performance was measured in node@14.15.5 when parsing [3.81 MB HTML file](./src/test/test.html).

To run a performance test use `npm run build; npm run perf`.

### Streaming

| Parser  | Ops/sec |
| --- | --- |
| [`TagSoup.createSaxParser`](https://smikhalevski.github.io/tag-soup/globals.html#createsaxparser) | 26 ±0.67% |
| [`TagSoup.createForgivingSaxParser`](https://smikhalevski.github.io/tag-soup/globals.html#createforgivingsaxparser) | 23 ±0.5% |
| [`TagSoup.createHtmlSaxParser`](https://smikhalevski.github.io/tag-soup/globals.html#createhtmlsaxparser) | 20 ±0.72% |
| [htmlparser2](https://github.com/fb55/htmlparser2)@6.1.0 | 14 ±0.46% |
| [sax-js](https://github.com/isaacs/sax-js)@1.2.4 | 1 ±54.26% † |

### DOM

| Parser  | Ops/sec |
| --- | --- |
| [`TagSoup.createXmlDomParser`](https://smikhalevski.github.io/tag-soup/globals.html#createxmldomparser) | 12 ±0.56% |
| [`TagSoup.createHtmlDomParser`](https://smikhalevski.github.io/tag-soup/globals.html#createhtmldomparser) | 9 ±0.71% |
| [htmlparser2](https://github.com/fb55/htmlparser2)@6.1.0 | 4 ± 59.91% † |
| [Parse5](https://github.com/inikulin/parse5)@6.0.1 | 3 ±0.76% |

† Performance cannot be measured with greater accuracy because of out-of-memory exceptions.

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
- SAX/DOM HTML parsing;
- Support of HTML implicit void tags like `<img>`;
- Support of HTML entities;
- Support of implicit HTML tag closing (like for `<p>foo<p>bar` which is `<p>foo</p><p>bar</p>`);
- Preconfigured Cheerio-compatible HTML DOM parser.

## Limitations

TagSoup can parse any XML document.

TagSoup can parse all weird HTML attribute syntax variations and any tag
names, [see tests for more details.](https://github.com/smikhalevski/tag-soup/blob/master/src/test/createSaxParser.test.ts)

At the same time, TagSoup isn't a full-blown HTML parser like in-browser `DOMParser`
or [Parse5](https://github.com/inikulin/parse5). It doesn't resolve all weird element structures that malformed HTML may
cause.

For example, assume the following markup

```html
<p><b>okay
<p>nope
``` 

Parse5 result

```html
<p><b>okay</b></p>
<p><b>nope</b></p>
``` 

TagSoup result

```html
<p><b>okay</b></p>
<p>nope</p> <!-- Note the absent b tag  -->
``` 
