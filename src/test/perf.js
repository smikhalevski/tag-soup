const fs = require('fs');
const path = require('path');
const bench = require('nodemark');
const htmlparser2 = require('htmlparser2');
const sax = require('sax');
const parse5 = require('parse5');
const {createSaxParser, createXmlDomParser} = require('../../lib');
const {createHtmlSaxParser, createHtmlDomParser} = require('../../lib/html');

const saxBenchDuration = 10000;
const domBenchDuration = 10000;

const html = fs.readFileSync(path.join(__dirname, './test.html'), 'utf8');

function round(v) {
  return v.toFixed(1);
}

console.log('SAX parser benchmark\n');

const tagSoupSaxParser = createSaxParser({});
const tagSoupSaxParserResult = bench(() => tagSoupSaxParser.commit(html), null, saxBenchDuration);
console.log('createSaxParser     ', tagSoupSaxParserResult);

const tagSoupHtmlSaxParser = createHtmlSaxParser({});
const tagSoupHtmlSaxParserResult = bench(() => tagSoupHtmlSaxParser.commit(html), null, saxBenchDuration);
console.log('createHtmlSaxParser ', tagSoupHtmlSaxParserResult);

const htmlparser2SaxParser = new htmlparser2.Parser({});
const htmlparser2SaxParserResult = bench(() => htmlparser2SaxParser.end(html), null, saxBenchDuration);
console.log('htmlparser2         ', htmlparser2SaxParserResult);

const saxParser = sax.parser();
const saxParserResult = bench(() => saxParser.write(html), null, saxBenchDuration);
console.log('sax                 ', saxParserResult);

console.log(`
htmlparser2
  ${round(htmlparser2SaxParserResult.mean / tagSoupSaxParserResult.mean)}✕ slower than createSaxParser
  ${round(htmlparser2SaxParserResult.mean / tagSoupHtmlSaxParserResult.mean)}✕ slower than createHtmlSaxParser

sax
  ${round(saxParserResult.mean / tagSoupSaxParserResult.mean)}✕ slower than createSaxParser
  ${round(saxParserResult.mean / tagSoupHtmlSaxParserResult.mean)}✕ slower than createHtmlSaxParser
`);

console.log('\nDOM parser benchmark\n');

const tagSoupXmlDomParser = createXmlDomParser({});
const tagSoupXmlDomResult = bench(() => tagSoupXmlDomParser.commit(html), null, domBenchDuration);
console.log('createXmlDomParser  ', tagSoupXmlDomResult);

const tagSoupHtmlDomParser = createHtmlDomParser({});
const tagSoupHtmlDomParserResult = bench(() => tagSoupHtmlDomParser.commit(html), null, domBenchDuration);
console.log('createHtmlDomParser ', tagSoupHtmlDomParserResult);

const htmlparser2DomParser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
const htmlparser2DomParserResult = bench(() => htmlparser2DomParser.end(html), null, domBenchDuration);
console.log('htmlparser2         ', htmlparser2DomParserResult);

const parse5ParserResult = bench(() => parse5.parse(html), null, domBenchDuration);
console.log('parse5              ', parse5ParserResult);

console.log(`
htmlparser2
  ${round(htmlparser2DomParserResult.mean / tagSoupXmlDomResult.mean)}✕ slower than createXmlDomParser
  ${round(htmlparser2DomParserResult.mean / tagSoupHtmlDomParserResult.mean)}✕ slower than createHtmlDomParser

parse5
  ${round(parse5ParserResult.mean / tagSoupXmlDomResult.mean)}✕ slower than createXmlDomParser
  ${round(parse5ParserResult.mean / tagSoupHtmlDomParserResult.mean)}✕ slower than createHtmlDomParser
`);
