import { h } from 'flyweight-dom/dsl';
import { expect, test } from 'vitest';
import { HTMLDOMParser, HTMLSAXParser, HTMLTokenizer, toHTML } from '../main/html.ts';

test('parses HTML DOM', () => {
  expect(HTMLDOMParser.parseFragment('<p>aaa<p>bbb</br>')).toStrictEqual(
    h.fragment(h('p', 'aaa'), h('p', 'bbb', h('br')))
  );
});

test('parses HTML DOM from chunks', () => {
  const writer = HTMLDOMParser.createFragmentWriter();

  writer.write('<p>aaa<p>b');
  writer.write('bb</b');

  expect(writer.end('r>')).toStrictEqual(h.fragment(h('p', 'aaa'), h('p', 'bbb', h('br'))));
});

test('decodes text and attribute values of each chunk', () => {
  const writer = HTMLDOMParser.createFragmentWriter();

  // Chunks without "&" are followed by chunks that have it before the end of the previous chunk
  writer.write('<p>aaaaaaaaaaaaaaaaaaaa</p>');
  writer.write('<p title="&amp;">&amp;</p>');
  writer.write('<p>bbbbbbbbbbbbbbbbbbbb</p>');

  expect(writer.end('<p>&amp;</p>')).toStrictEqual(
    h.fragment(h('p', 'aaaaaaaaaaaaaaaaaaaa'), h('p', { title: '&' }, '&'), h('p', 'bbbbbbbbbbbbbbbbbbbb'), h('p', '&'))
  );
});

test('parses HTML SAX', () => {
  const calls: unknown[][] = [];

  HTMLSAXParser.parseFragment('<p>aaa<p>bbb</br>', {
    onStartTagOpening(tagName) {
      calls.push(['onStartTagOpening', tagName]);
    },
    onText(text) {
      calls.push(['onText', text]);
    },
    onEndTag(tagName, namespaceURI) {
      calls.push(['onEndTag', tagName, namespaceURI]);
    },
  });

  expect(calls).toStrictEqual([
    ['onStartTagOpening', 'p'],
    ['onText', 'aaa'],
    ['onEndTag', 'p', null],
    ['onStartTagOpening', 'p'],
    ['onText', 'bbb'],
    ['onStartTagOpening', 'br'],
    ['onEndTag', 'br', null],
    ['onEndTag', 'p', null],
  ]);
});

test('parses HTML SAX from chunks', () => {
  const calls: unknown[][] = [];

  const writer = HTMLSAXParser.createDocumentWriter({
    onDoctype(name, publicId, systemId) {
      calls.push(['onDoctype', name, publicId, systemId]);
    },
    onStartTagOpening(tagName) {
      calls.push(['onStartTagOpening', tagName]);
    },
    onText(text) {
      calls.push(['onText', text]);
    },
  });

  writer.write('  <!DOCTYPE ht');
  writer.write('ml><P>a&am');
  writer.end('p;b');

  expect(calls).toStrictEqual([
    ['onDoctype', 'html', '', ''],
    ['onStartTagOpening', 'p'],
    ['onText', 'a&b'],
  ]);
});

test('passes decoded text and attribute values of each chunk to the SAX handler', () => {
  const calls: unknown[][] = [];

  const writer = HTMLSAXParser.createFragmentWriter({
    onAttribute(name, value) {
      calls.push(['onAttribute', name, value]);
    },
    onText(text) {
      calls.push(['onText', text]);
    },
  });

  // Chunks without "&" are followed by chunks that have it before the end of the previous chunk
  writer.write('<p>aaaaaaaaaaaaaaaaaaaa</p>');
  writer.write('<p title="&amp;">&amp;</p>');
  writer.write('<p>bbbbbbbbbbbbbbbbbbbb</p>');
  writer.end('<p>&amp;</p>');

  expect(calls).toStrictEqual([
    ['onText', 'aaaaaaaaaaaaaaaaaaaa'],
    ['onAttribute', 'title', '&'],
    ['onText', '&'],
    ['onText', 'bbbbbbbbbbbbbbbbbbbb'],
    ['onText', '&'],
  ]);
});

test('passes lower case names and decoded values to the SAX handler', () => {
  const calls: unknown[][] = [];

  HTMLSAXParser.parseFragment('<A HREF="?aaa=111&amp;bbb=222&copy=333">&copy=333</A>', {
    onStartTag(tagName, attributes, isSelfClosing, namespaceURI) {
      calls.push(['onStartTag', tagName, attributes, isSelfClosing, namespaceURI]);
    },
    onText(text) {
      calls.push(['onText', text]);
    },
    onEndTag(tagName, namespaceURI) {
      calls.push(['onEndTag', tagName, namespaceURI]);
    },
  });

  expect(calls).toStrictEqual([
    ['onStartTag', 'a', { href: '?aaa=111&bbb=222&copy=333' }, false, null],
    ['onText', '©=333'],
    ['onEndTag', 'a', null],
  ]);
});

test('passes raw text to the SAX handler as is, and decodes escapable raw text', () => {
  const texts: string[] = [];

  HTMLSAXParser.parseFragment('<script>a<b&amp;</script><textarea>a<b&amp;</textarea>', {
    onText(text) {
      texts.push(text);
    },
  });

  expect(texts).toStrictEqual(['a<b&amp;', 'a<b&']);
});

test('does not pass namespaces to the SAX handler', () => {
  const calls: unknown[][] = [];

  HTMLSAXParser.parseFragment('<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>', {
    onStartTag(tagName, attributes, isSelfClosing, namespaceURI) {
      calls.push(['onStartTag', tagName, attributes, isSelfClosing, namespaceURI]);
    },
    onEndTag(tagName, namespaceURI) {
      calls.push(['onEndTag', tagName, namespaceURI]);
    },
  });

  expect(calls).toStrictEqual([
    ['onStartTag', 'svg', { xmlns: 'http://www.w3.org/2000/svg' }, false, null],
    ['onStartTag', 'circle', {}, true, null],
    ['onEndTag', 'svg', null],
  ]);
});

test('reads tokens of void tags and tags that are not ended', () => {
  const tokens: unknown[][] = [];

  HTMLTokenizer.tokenizeFragment('<p>hello<p>cool</br>', {
    onStartTagName(input, startIndex, endIndex) {
      tokens.push(['onStartTagName', input.substring(startIndex, endIndex), startIndex, endIndex]);
    },
    onStartTagClosing(input, startIndex, endIndex) {
      tokens.push(['onStartTagClosing', input.substring(startIndex, endIndex), startIndex, endIndex]);
    },
    onText(input, startIndex, endIndex, isRawText) {
      tokens.push(['onText', input.substring(startIndex, endIndex), startIndex, endIndex, isRawText]);
    },
    onEndTagName(input, startIndex, endIndex) {
      tokens.push(['onEndTagName', input.substring(startIndex, endIndex), startIndex, endIndex]);
    },
  });

  expect(tokens).toStrictEqual([
    ['onStartTagName', 'p', 1, 2],
    ['onStartTagClosing', '>', 2, 3],
    ['onText', 'hello', 3, 8, false],
    ['onEndTagName', '', 8, 8],
    ['onStartTagName', 'p', 9, 10],
    ['onStartTagClosing', '>', 10, 11],
    ['onText', 'cool', 11, 15, false],
    ['onStartTagName', 'br', 17, 19],
    ['onStartTagClosing', '>', 19, 20],
    ['onEndTagName', 'br', 17, 19],
    ['onEndTagName', '', 20, 20],
  ]);
});

test('reads tokens without renaming tags and attributes and without decoding entities', () => {
  const tokens: unknown[][] = [];

  HTMLTokenizer.tokenizeFragment('<A HREF="&amp;">&amp;</a>', {
    onStartTagName(input, startIndex, endIndex) {
      tokens.push(['onStartTagName', input.substring(startIndex, endIndex)]);
    },
    onAttribute(input, nameStartIndex, nameEndIndex, valueStartIndex, valueEndIndex) {
      tokens.push([
        'onAttribute',
        input.substring(nameStartIndex, nameEndIndex),
        input.substring(valueStartIndex, valueEndIndex),
      ]);
    },
    onText(input, startIndex, endIndex) {
      tokens.push(['onText', input.substring(startIndex, endIndex)]);
    },
    onEndTagName(input, startIndex, endIndex) {
      tokens.push(['onEndTagName', input.substring(startIndex, endIndex)]);
    },
  });

  expect(tokens).toStrictEqual([
    ['onStartTagName', 'A'],
    ['onAttribute', 'HREF', '&amp;'],
    ['onText', '&amp;'],
    ['onEndTagName', 'a'],
  ]);
});

test('marks text tokens of raw text and script data tags as raw', () => {
  const tokens: unknown[][] = [];

  HTMLTokenizer.tokenizeFragment('<script>a<b</script><style>c<d</style><title>e<f</title>ggg', {
    onText(input, startIndex, endIndex, isRawText) {
      tokens.push([input.substring(startIndex, endIndex), isRawText]);
    },
  });

  expect(tokens).toStrictEqual([
    ['a<b', true],
    ['c<d', true],
    ['e<f', false],
    ['ggg', false],
  ]);
});

test('reads the DOCTYPE token of a document', () => {
  const tokens: unknown[][] = [];

  HTMLTokenizer.tokenizeDocument('  <!DOCTYPE html>aaa', {
    onDoctype(input, nameStartIndex, nameEndIndex) {
      tokens.push(['onDoctype', input.substring(nameStartIndex, nameEndIndex)]);
    },
    onText(input, startIndex, endIndex) {
      tokens.push(['onText', input.substring(startIndex, endIndex)]);
    },
  });

  expect(tokens).toStrictEqual([
    ['onDoctype', 'html'],
    ['onText', 'aaa'],
  ]);
});

test('serializes HTML', () => {
  expect(toHTML(HTMLDOMParser.parseDocument('<!DOCTYPEhtml><p>aaa&gt;&lt;<p>bbb</BR>'))).toBe(
    '<!DOCTYPE html><p>aaa&gt;&lt;</p><p>bbb<br></p>'
  );
});

test('parses DOCTYPE of a document', () => {
  expect(HTMLDOMParser.parseDocument('  <!DOCTYPE html><html>aaa</html>')).toStrictEqual(
    h.document(h.doctype('html'), h('html', 'aaa'))
  );
});

test('ignores DOCTYPE in a fragment', () => {
  expect(HTMLDOMParser.parseFragment('<!DOCTYPE html>aaa')).toStrictEqual(h.fragment('aaa'));
});

test('round-trips comments', () => {
  const html = '<!-- aaa --><p><!--&amp;--></p>';

  expect(toHTML(HTMLDOMParser.parseFragment(html))).toBe(html);
});

test('round-trips a well-formed document', () => {
  const html =
    '<!DOCTYPE html><html><head><title>aaa &amp; bbb</title><style>a > b {}</style></head>' +
    '<body><!-- ccc --><p class="ddd">eee<br><img src="fff"></p><script>if (a < b) {}</script>' +
    '<svg><path d="M0 0"></path><![CDATA[ggg]]></svg></body></html>';

  expect(toHTML(HTMLDOMParser.parseDocument(html))).toBe(html);
});

test('converts tag names and attribute names to lower case', () => {
  expect(HTMLDOMParser.parseFragment('<A HREF="aaa">bbb</A>')).toStrictEqual(
    h.fragment(h('a', { href: 'aaa' }, 'bbb'))
  );
});

test('does not convert non-ASCII letters of names to lower case', () => {
  expect(HTMLDOMParser.parseFragment('<DÉV ÀTTR="aaa"></DÉV>')).toStrictEqual(h.fragment(h('dÉv', { Àttr: 'aaa' })));
});

test('converts repeated names of any length to lower case', () => {
  const names = [
    'B',
    'BB',
    'BBBBB',
    'BBBBBBBBB',
    'BBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBC',
  ];

  const html = names.map(name => `<${name} ${name}="aaa"></${name}>`).join('');

  const createElements = () => names.map(name => h(name.toLowerCase(), { [name.toLowerCase()]: 'aaa' }));

  expect(HTMLDOMParser.parseFragment(html + html)).toStrictEqual(h.fragment(...createElements(), ...createElements()));
});

test('does not recognize namespaces', () => {
  expect(HTMLDOMParser.parseFragment('<svg xmlns="aaa"><path/></svg>')).toStrictEqual(
    h.fragment(h('svg', { xmlns: 'aaa' }, h('path')))
  );
});

test('encodes attribute values', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<a aaa="&quot;">'))).toBe('<a aaa="&quot;"></a>');
});

test('encodes markup characters in text and attribute values', () => {
  expect(toHTML(h('a', { title: `&<>"'` }, `&<>"'`))).toBe(
    '<a title="&amp;&lt;&gt;&quot;&apos;">&amp;&lt;&gt;&quot;&apos;</a>'
  );
});

test('decodes attribute values differently from text', () => {
  expect(HTMLDOMParser.parseFragment('<a href="?aaa=111&amp;bbb=222&copy=333">&copy=333</a>')).toStrictEqual(
    h.fragment(h('a', { href: '?aaa=111&bbb=222&copy=333' }, '©=333'))
  );
});

test('decodes numeric character references in text and attribute values', () => {
  expect(HTMLDOMParser.parseFragment('<a title="&#65;&#x42;">&#65;&#x42;</a>')).toStrictEqual(
    h.fragment(h('a', { title: 'AB' }, 'AB'))
  );
});

test('parses unquoted attribute values with slashes', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<a href=http://aaa/bbb>ccc</a>'))).toBe(
    '<a href="http://aaa/bbb">ccc</a>'
  );
});

test('serializes void and raw text tags ignoring the case of tag names', () => {
  expect(toHTML(h.fragment(h('BR'), h('SCRIPT', '<')))).toBe('<BR><SCRIPT><</SCRIPT>');
});

test('ends list items inside the nearest list', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<ul><li>aaa<li>bbb<ul><li>ccc<li>ddd</ul></ul>'))).toBe(
    '<ul><li>aaa</li><li>bbb<ul><li>ccc</li><li>ddd</li></ul></li></ul>'
  );
});

test('ends a table cell when the next cell starts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<table><thead><tr><td>aaa<td>bbb</table>'))).toBe(
    '<table><thead><tr><td>aaa</td><td>bbb</td></tr></thead></table>'
  );
});

test('ends table rows and cells when the next row or cell starts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<table><tr><td>aaa<th>bbb<tr><td>ccc</table>'))).toBe(
    '<table><tr><td>aaa</td><th>bbb</th></tr><tr><td>ccc</td></tr></table>'
  );
});

test('does not end cells of an outer table with rows and cells of a nested table', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<table><tr><td><table><tr><td>aaa</table><td>bbb</table>'))).toBe(
    '<table><tr><td><table><tr><td>aaa</td></tr></table></td><td>bbb</td></tr></table>'
  );
});

test('ends the table section when the next one starts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<table><thead><tr><th>aaa<tbody><tr><td>bbb</table>'))).toBe(
    '<table><thead><tr><th>aaa</th></tr></thead><tbody><tr><td>bbb</td></tr></tbody></table>'
  );
});

test('ends a paragraph with list items and blocks', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<p>aaa<li>bbb<p>ccc<center>ddd'))).toBe(
    '<p>aaa</p><li>bbb<p>ccc</p><center>ddd</center></li>'
  );
});

test.each([
  'address',
  'article',
  'aside',
  'blockquote',
  'center',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'li',
  'listing',
  'main',
  'menu',
  'nav',
  'ol',
  'p',
  'plaintext',
  'pre',
  'search',
  'section',
  'summary',
  'table',
  'ul',
  'xmp',
])('ends a paragraph when %s starts', tagName => {
  expect(HTMLDOMParser.parseFragment(`<p>aaa<${tagName}>`)).toStrictEqual(h.fragment(h('p', 'aaa'), h(tagName)));
});

test('does not end a paragraph when a phrasing tag starts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<p>aaa<span>bbb<b>ccc'))).toBe('<p>aaa<span>bbb<b>ccc</b></span></p>');
});

test.each(['applet', 'button', 'caption', 'html', 'marquee', 'object', 'td', 'template', 'th'])(
  'does not end a paragraph outside of %s',
  tagName => {
    expect(HTMLDOMParser.parseFragment(`<p>aaa<${tagName}><p>bbb`)).toStrictEqual(
      h.fragment(h('p', 'aaa', h(tagName, h('p', 'bbb'))))
    );
  }
);

test.each(['dl', 'ol', 'table', 'ul'])('does not end a list item outside of %s', tagName => {
  expect(HTMLDOMParser.parseFragment(`<li>aaa<${tagName}><li>bbb`)).toStrictEqual(
    h.fragment(h('li', 'aaa', h(tagName, h('li', 'bbb'))))
  );
});

test('ends a heading when another heading starts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<h1>aaa<h2>bbb<h3>ccc<h4>ddd<h5>eee<h6>fff<h1>ggg'))).toBe(
    '<h1>aaa</h1><h2>bbb</h2><h3>ccc</h3><h4>ddd</h4><h5>eee</h5><h6>fff</h6><h1>ggg</h1>'
  );
});

test('ends an anchor when another anchor starts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<a>aaa<a>bbb'))).toBe('<a>aaa</a><a>bbb</a>');
});

test('ends description terms and details inside the nearest description list', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<dl><dt>aaa<dd>bbb<dl><dt>ccc</dl><dt>ddd</dl>'))).toBe(
    '<dl><dt>aaa</dt><dd>bbb<dl><dt>ccc</dt></dl></dd><dt>ddd</dt></dl>'
  );
});

test('ends the head when the body starts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<head><title>aaa</title><body>bbb'))).toBe(
    '<head><title>aaa</title></head><body>bbb</body>'
  );
});

test('ends ruby annotations', () => {
  expect(
    toHTML(HTMLDOMParser.parseFragment('<ruby><rb>aaa<rt>bbb<rp>ccc<rb>ddd<rtc>eee<rp>fff<rtc>ggg<rb>hhh</ruby>'))
  ).toBe(
    '<ruby><rb>aaa</rb><rt>bbb</rt><rp>ccc</rp><rb>ddd</rb><rtc>eee<rp>fff</rp></rtc><rtc>ggg</rtc><rb>hhh</rb></ruby>'
  );
});

test.each([
  'area',
  'base',
  'basefont',
  'bgsound',
  'br',
  'col',
  'embed',
  'frame',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])('parses and serializes %s as a void tag', tagName => {
  expect(toHTML(HTMLDOMParser.parseFragment(`<${tagName}>aaa`))).toBe(`<${tagName}>aaa`);
});

test('parses command and isindex as normal tags', () => {
  const html = '<command>aaa</command><isindex>bbb</isindex>';

  expect(toHTML(HTMLDOMParser.parseFragment(html))).toBe(html);
});

test('parses xmp as raw text that ends a paragraph', () => {
  expect(HTMLDOMParser.parseFragment('<p>aaa<xmp><p>&amp;</xmp>')).toStrictEqual(
    h.fragment(h('p', 'aaa'), h('xmp', '<p>&amp;'))
  );
});

test('parses title as escapable raw text', () => {
  expect(HTMLDOMParser.parseFragment('<title><b>&amp;</b></title>')).toStrictEqual(h.fragment(h('title', '<b>&</b>')));
});

test.each(['iframe', 'noembed', 'noframes', 'plaintext', 'script', 'style', 'xmp'])(
  'parses and serializes %s as raw text',
  tagName => {
    const html = `<${tagName}><b>&amp;</b></${tagName}>`;
    const fragment = HTMLDOMParser.parseFragment(html);

    expect(fragment).toStrictEqual(h.fragment(h(tagName, '<b>&amp;</b>')));
    expect(toHTML(fragment)).toBe(html);
  }
);

test.each(['textarea', 'title'])('parses and serializes %s as escapable raw text', tagName => {
  const fragment = HTMLDOMParser.parseFragment(`<${tagName}><b>&amp;</b></${tagName}>`);

  expect(fragment).toStrictEqual(h.fragment(h(tagName, '<b>&</b>')));
  expect(toHTML(fragment)).toBe(`<${tagName}>&lt;b&gt;&amp;&lt;/b&gt;</${tagName}>`);
});

test('round-trips raw text and escapable raw text', () => {
  const html = '<script>aaa<bbb&lt;</script><textarea>aaa&lt;bbb</textarea>';

  expect(toHTML(HTMLDOMParser.parseFragment(html))).toBe(html);
});

test('round-trips escaped script data', () => {
  const html = '<script><!--<script></script></script>';

  expect(toHTML(HTMLDOMParser.parseFragment(html))).toBe(html);
});

test('does not switch options for math inside SVG', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg><math><foreignObject><b/>aaa'))).toBe(
    '<svg><math><foreignobject><b>aaa</b></foreignobject></math></svg>'
  );
});

test('does not switch options for svg inside MathML', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<math><svg><foreignObject><b/>aaa'))).toBe(
    '<math><svg><foreignobject><b></b>aaa</foreignobject></svg></math>'
  );
});

test('parses title inside SVG and MathML as a tag', () => {
  const html = '<svg><title><a>aaa</a></title></svg><math><title><mi>bbb</mi></title></math>';

  expect(toHTML(HTMLDOMParser.parseFragment(html))).toBe(html);
});

test('parses content of foreignObject inside SVG as HTML', () => {
  expect(
    toHTML(
      HTMLDOMParser.parseFragment('<svg><foreignObject><p>aaa<p>bbb<br><![CDATA[ccc]]></foreignObject><path/></svg>')
    )
  ).toBe('<svg><foreignobject><p>aaa</p><p>bbb<br><!--[CDATA[ccc]]--></p></foreignobject><path></path></svg>');
});

test('does not parse content of foreignObject inside MathML as HTML', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<math><foreignObject><b/>aaa'))).toBe(
    '<math><foreignobject><b></b>aaa</foreignobject></math>'
  );
});

test('restores options after foreignObject and after svg', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg><foreignObject><a/>aaa</foreignObject><g/>bbb</svg><a/>ccc'))).toBe(
    '<svg><foreignobject><a>aaa</a></foreignobject><g></g>bbb</svg><a>ccc</a>'
  );
});

test('restores HTML options after a self-closing svg', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg/><a/>aaa'))).toBe('<svg></svg><a>aaa</a>');
});

test('recognizes self-closing tags inside SVG and MathML only', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg><path/>aaa</svg><math><mi/>bbb</math><div/>ccc'))).toBe(
    '<svg><path></path>aaa</svg><math><mi></mi>bbb</math><div>ccc</div>'
  );
});

test('recognizes CDATA sections inside SVG and MathML only', () => {
  expect(
    HTMLDOMParser.parseFragment('<svg><![CDATA[a<b]]></svg><math><![CDATA[c<d]]></math><![CDATA[e<f]]>')
  ).toStrictEqual(h.fragment(h('svg', h.cdata('a<b')), h('math', h.cdata('c<d')), h.comment('[CDATA[e<f]]')));
});

test('reads processing instructions inside SVG and MathML by HTML rules', () => {
  expect(HTMLDOMParser.parseFragment('<svg><?aaa bbb>ccc?></svg><math><?ddd eee>fff?></math>')).toStrictEqual(
    h.fragment(
      h('svg', h.processingInstruction('aaa', 'bbb'), 'ccc?>'),
      h('math', h.processingInstruction('ddd', 'eee'), 'fff?>')
    )
  );
});

test('does not end tags outside foreignObject with end tags inside it', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<body><div><svg><path/><foreignObject><em></div><i></body>'))).toBe(
    '<body><div><svg><path></path><foreignobject><em><i></i></em></foreignobject></svg></div></body>'
  );
});

test('does not end tags outside a table cell with end tags inside it', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<div><table><tr><td>a</div>b</td></tr></table>c'))).toBe(
    '<div><table><tr><td>ab</td></tr></table>c</div>'
  );
});

test('ends a table cell and a row with the end tag of the table', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<table><tr><td>a</table>b'))).toBe('<table><tr><td>a</td></tr></table>b');
});

test('inserts a paragraph for its end tag inside a button', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<p><button>a</p>b</button>c'))).toBe('<p><button>a<p></p>b</button>c</p>');
});

test('implicitly ends a paragraph from SVG and MathML content', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<p>aaa<svg><p>bbb<math><p>ccc'))).toBe(
    '<p>aaa<svg></svg></p><p>bbb<math></math></p><p>ccc</p>'
  );
});

test('implicitly ends SVG and MathML with HTML tags', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg><br>aaa<math><br>bbb'))).toBe(
    '<svg></svg><br>aaa<math></math><br>bbb'
  );
});

test.each([
  'b',
  'big',
  'blockquote',
  'body',
  'br',
  'center',
  'code',
  'dd',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'hr',
  'i',
  'img',
  'li',
  'listing',
  'menu',
  'meta',
  'nobr',
  'ol',
  'p',
  'pre',
  'ruby',
  's',
  'small',
  'span',
  'strong',
  'strike',
  'sub',
  'sup',
  'table',
  'tt',
  'u',
  'ul',
  'var',
])('ends SVG and MathML when %s starts', tagName => {
  expect(HTMLDOMParser.parseFragment(`<svg><g><${tagName}>`)).toStrictEqual(h.fragment(h('svg', h('g')), h(tagName)));

  expect(HTMLDOMParser.parseFragment(`<math><mrow><${tagName}>`)).toStrictEqual(
    h.fragment(h('math', h('mrow')), h(tagName))
  );
});

test('does not end SVG and MathML when other tags start', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg><a><font>aaa</svg><math><a><font>bbb'))).toBe(
    '<svg><a><font>aaa</font></a></svg><math><a><font>bbb</font></a></math>'
  );
});

test('does not implicitly end outer tags with tags inside SVG and MathML', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<a><svg><a></a></svg><math><a>'))).toBe(
    '<a><svg><a></a></svg><math><a></a></math></a>'
  );
});

test('does not implicitly end SVG and MathML inside integration points', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg><title><p>aaa</svg><math><mi><p>bbb</math>'))).toBe(
    '<svg><title><p>aaa</p></title></svg><math><mi><p>bbb</p></mi></math>'
  );
});

test.each([
  ['svg', 'desc'],
  ['svg', 'foreignObject'],
  ['svg', 'title'],
  ['math', 'annotation-xml'],
  ['math', 'mi'],
  ['math', 'mn'],
  ['math', 'mo'],
  ['math', 'ms'],
  ['math', 'mtext'],
])('does not end %s when a paragraph starts inside %s', (foreignTagName, tagName) => {
  expect(HTMLDOMParser.parseFragment(`<${foreignTagName}><${tagName}><p>aaa`)).toStrictEqual(
    h.fragment(h(foreignTagName, h(tagName.toLowerCase(), h('p', 'aaa'))))
  );
});

test('closes self-closing foreignObject by SVG rules', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<svg><foreignObject/><g/></svg>'))).toBe(
    '<svg><foreignobject></foreignobject><g></g></svg>'
  );
});

test('ends a select with an input, but not with other form controls', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<select><textarea>a</textarea><input><button>b'))).toBe(
    '<select><textarea>a</textarea></select><input><button>b</button>'
  );
});

test('ends an option with hr', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<select><option>a<hr><option>b'))).toBe(
    '<select><option>a</option><hr><option>b</option></select>'
  );
});

test('ends options and option groups', () => {
  expect(
    toHTML(HTMLDOMParser.parseFragment('<select><optgroup><option>aaa<option>bbb<optgroup><option>ccc</select>'))
  ).toBe(
    '<select><optgroup><option>aaa</option><option>bbb</option></optgroup><optgroup><option>ccc</option></optgroup></select>'
  );
});

test('ends a button when another button starts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<button>aaa<button>bbb'))).toBe(
    '<button>aaa</button><button>bbb</button>'
  );
});

test('ends a caption and a colgroup with table parts', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<table><caption>a<colgroup><col><tr><td>b'))).toBe(
    '<table><caption>a</caption><colgroup><col></colgroup><tr><td>b</td></tr></table>'
  );
});

test('reads processing instructions', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<?php echo 1 ?>a<?xml b?>'))).toBe('<?php echo 1 ?>a<!--?xml b?-->');
});

test('inserts a start tag for an unbalanced p end tag', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('aaa</p>bbb'))).toBe('aaa<p></p>bbb');
});

test('ignores an unbalanced end tag', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<a>aaa</b>bbb</a>'))).toBe('<a>aaabbb</a>');
});

test('ends tags that are not ended before the end tag of an ancestor', () => {
  expect(toHTML(HTMLDOMParser.parseFragment('<a><b>aaa</a>bbb'))).toBe('<a><b>aaa</b></a>bbb');
});

test.each([
  ['<', '&lt;'],
  ['</', '&lt;/'],
  ['</a', ''],
  ['<a', '<a></a>'],
  ['<a b', '<a b=""></a>'],
  ['<a b=', '<a b=""></a>'],
  ['<a b="c', '<a b="c"></a>'],
  ['<!', '<!---->'],
  ['<!--a', '<!--a-->'],
  ['<?a', ''],
  ['<![CDATA[a', '<!--[CDATA[a-->'],
  ['<script>a', '<script>a</script>'],
  ['<svg><![CDATA[a', '<svg><![CDATA[a]]></svg>'],
  ['<svg><?a b', '<svg></svg>'],
])('recovers from %j at the end of the input', (html, expectedHTML) => {
  expect(toHTML(HTMLDOMParser.parseFragment(html))).toBe(expectedHTML);
});
