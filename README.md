<p align="center">
  <a href="#readme"><img alt="TagSoup" src="./assets/logo.png" width="250" /></a>
</p>

TagSoup is [the fastest](#performance) pure JS SAX/DOM XML/HTML parser.

- Extremely low memory consumption.
- Forgives malformed tag nesting, missing end tags, etc.
- Recognizes CDATA, processing instructions, and DOCTYPE.
- Supports XML and HTML DOM serialization.
- [20 kB gzipped&#8239;<sup>↗</sup>](https://bundlephobia.com/result?p=tag-soup), including dependencies.
- Check out [Speedy Entities&#8239;<sup>↗</sup>](https://github.com/smikhalevski/speedy-entities#readme)
  and [Flyweight DOM&#8239;<sup>↗</sup>](https://github.com/smikhalevski/flyweight-dom#readme), the only dependencies TagSoup has.

```sh
npm install --save-prod tag-soup
```

- [API docs&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/)
- [DOM parsing](#dom-parsing)
- [SAX parsing](#sax-parsing)
- [Tokenization](#tokenization)
- [Performance](#performance)
- [Limitations](#limitations)

# DOM parsing

TagSoup exports preconfigured [`HTMLDOMParser`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/variables/HTMLDOMParser.html)
which parses HTML markup as a DOM node. `HTMLDOMParser` never throws errors during parsing and forgives malformed
markup:

```ts
import { HTMLDOMParser, toHTML } from 'tag-soup';

const fragment = HTMLDOMParser.parseFragment('<p>hello<p>cool</br>');
// ⮕ DocumentFragment

toHTML(fragment);
// ⮕ '<p>hello</p><p>cool<br></p>'
```

`HTMLDOMParser` decodes both HTML entities and numeric character references with
[Speedy Entities&#8239;<sup>↗</sup>](https://github.com/smikhalevski/speedy-entities#readme), the fastest entities
encoder/decoder.

[`XMLDOMParser`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/variables/XMLDOMParser.html)
parses XML markup as a DOM node. It throws
[`ParserError`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/classes/ParserError.html) if markup doesn't
satisfy XML specification:

```ts
import { XMLDOMParser, toXML } from 'tag-soup';

XMLDOMParser.parseFragment('<p>hello</br>');
// ❌ ParserError: Unexpected end tag.

const fragment = XMLDOMParser.parseFragment('<p>hello<br/></p>');
// ⮕ DocumentFragment

toXML(fragment);
// ⮕ '<p>hello<br/></p>
```

`XMLDOMParser` decodes both XML entities and numeric character references with
[Speedy Entities&#8239;<sup>↗</sup>](https://github.com/smikhalevski/speedy-entities#readme).

TagSoup uses [Flyweight DOM&#8239;<sup>↗</sup>](https://github.com/smikhalevski/flyweight-dom#readme) nodes,
which provide many standard DOM manipulation features:

```ts
const document = HTMLDOMParser.parseDocument('<!DOCTYPE html><html>hello</html>');

document.doctype.name;
// ⮕ 'html'

document.textContent;
// ⮕ 'hello'
```

Create a custom DOM parser using
[`createDOMParser`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/functions/createDOMParser.html):

```ts
import { createDOMParser } from 'tag-soup';

const myParser = createDOMParser({
  voidTags: ['br'],
});

myParser.parseFragment('<p><br></p>');
// ⮕ DocumentFragment
```

# SAX parsing

TagSoup exports preconfigured
[`HTMLSAXParser`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/variables/HTMLSAXParser.html) which parses
HTML markup and calls handler methods when a token is read. `HTMLSAXParser` never throws errors during parsing and
forgives malformed markup:

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

[`XMLSAXParser`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/variables/XMLSAXParser.html)
parses XML markup and calls handler methods when a token is read. It throws
[`ParserError`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/classes/ParserError.html) if markup doesn't satisfy XML
specification:

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
[`createSAXParser`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/functions/createSAXParser.html):

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

# Tokenization

TagSoup exports preconfigured [`HTMLTokenizer`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/variables/HTMLSAXParser.html)
which parses HTML markup and invokes a callback when a token is read. `HTMLTokenizer` never throws errors during
parsing and forgives malformed markup:

```ts
import { HTMLTokenizer } from 'tag-soup';

HTMLTokenizer.tokenizeFragment('<p>hello<p>cool</br>', (token, startIndex, endIndex) => {
  // Handle token
});
```

[`XMLTokenizer`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/variables/XMLTokenizer.html)
parses XML markup and invokes a callback when a token is read. It throws
[`ParserError`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/classes/ParserError.html) if markup doesn't satisfy XML
specification:

```ts
import { XMLTokenizer } from 'tag-soup';

XMLTokenizer.tokenizeFragment('<p>hello</br>', (token, startIndex, endIndex) => {});
// ❌ ParserError: Unexpected end tag.

XMLTokenizer.tokenizeFragment('<p>hello<br/></p>', (token, startIndex, endIndex) => {
  // Handle token
});
```

Create a custom tokenizer using
[`createTokenizer`&#8239;<sup>↗</sup>](https://smikhalevski.github.io/tag-soup/functions/createTokenizer.html):

```ts
import { createTokenizer } from 'tag-soup';

const myTokenizer = createTokenizer({
  voidTags: ['br'],
});

myTokenizer.tokenizeFragment('<p><br></p>', (token, startIndex, endIndex) => {
  // Handle token
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
<td align="right">tag-soup&#x200B;@3.0.0</td>
<td align="right">
<a href="https://bundlephobia.com/package/tag-soup@3.0.0">20 kB&#8239;<sup>↗</sup></a>
</td>
<td align="right"><strong>26</strong> Hz</td>
<td align="right"><strong>22</strong> MB</td>
<td align="right"><strong>58</strong> Hz</td>
<td align="right"><strong>22</strong> kB</td>
</tr>

<tr>
<td align="right">
<a href="https://gitdub.com/fb55/htmlparser2">htmlparser2</a>&#x200B;@10.0.0
</td>
<td align="right">
<a href="https://bundlephobia.com/package/htmlparser2@10.0.0">58 kB&#8239;<sup>↗</sup></a>
</td>
<td align="right">19 Hz</td>
<td align="right">23 MB</td>
<td align="right">31 Hz</td>
<td align="right">10 MB</td>
</tr>

<tr>
<td align="right">
<a href="https://gitdub.com/inikulin/parse5">parse5</a>&#x200B;@8.0.0
</td>
<td align="right">
<a href="https://bundlephobia.com/package/parse5@8.0.0">45 kB&#8239;<sup>↗</sup></a>
</td>
<td align="right">7 Hz</td>
<td align="right">105 MB</td>
<td align="center" colspan="2">🚫</td>
</tr>

</table>

Performance was measured when parsing [the 3.8 MB HTML file](./src/test/test.html).

Tests were conducted using [TooFast](https://github.com/smikhalevski/toofast#readme) on Apple M1 with Node.js v23.11.1.

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

With [`DOMParser`&#8239;<sup>↗</sup>](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser) this markup would be transformed to:

```html
<p><strong>okay</strong></p>
<p><strong>nope</strong></p>
```

TagSoup doesn't insert the second `strong` tag:

```html
<p><strong>okay</strong></p>
<p>nope</p>
```
