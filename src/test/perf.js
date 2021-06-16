const fs = require('fs');
const path = require('path');
const bench = require('nodemark');
const htmlparser2 = require('htmlparser2');
const sax = require('sax');
const parse5 = require('parse5');
const {createSaxParser, createForgivingSaxParser, createXmlDomParser} = require('../../lib/index-cjs');
const {createHtmlSaxParser, createHtmlDomParser} = require('../../lib/html-cjs');

const gc = global.gc || (() => undefined);

const saxBenchDuration = 10_000;
const domBenchDuration = 10_000;

const html = fs.readFileSync(path.join(__dirname, './test.html'), 'utf8');

function round(value) {
  return value.toFixed(1);
}

console.log(`SAX parser benchmark (${saxBenchDuration / 1000} seconds per test)\n`);

const tagSoupSaxParser = createSaxParser({});
const tagSoupSaxParserResult = bench(() => tagSoupSaxParser.parse(html), null, saxBenchDuration);
console.log('createSaxParser          ', tagSoupSaxParserResult);

gc();

const tagSoupForgivingSaxParser = createForgivingSaxParser({});
const tagSoupForgivingSaxParserResult = bench(() => tagSoupForgivingSaxParser.parse(html), null, saxBenchDuration);
console.log('createForgivingSaxParser ', tagSoupForgivingSaxParserResult);

gc();

const tagSoupHtmlSaxParser = createHtmlSaxParser({});
const tagSoupHtmlSaxParserResult = bench(() => tagSoupHtmlSaxParser.parse(html), null, saxBenchDuration);
console.log('createHtmlSaxParser      ', tagSoupHtmlSaxParserResult);

gc();

const htmlparser2SaxParser = new htmlparser2.Parser({});
const htmlparser2SaxParserResult = bench(() => htmlparser2SaxParser.end(html), null, saxBenchDuration);
console.log('htmlparser2              ', htmlparser2SaxParserResult);

gc();

const saxParser = sax.parser();
const saxParserResult = bench(() => saxParser.write(html), null, saxBenchDuration);
console.log('sax                      ', saxParserResult);

gc();

console.log(`
createSaxParser
  ${round(htmlparser2SaxParserResult.mean / tagSoupSaxParserResult.mean)}✕ faster than htmlparser2
  ${round(saxParserResult.mean / tagSoupSaxParserResult.mean)}✕ faster than sax
  
createHtmlSaxParser
  ${round(htmlparser2SaxParserResult.mean / tagSoupHtmlSaxParserResult.mean)}✕ faster than htmlparser2
  ${round(saxParserResult.mean / tagSoupHtmlSaxParserResult.mean)}✕ faster than sax
`);

console.log(`\nDOM parser benchmark (${domBenchDuration / 1000} seconds per test)\n`);

const tagSoupXmlDomParser = createXmlDomParser({});
const tagSoupXmlDomResult = bench(() => tagSoupXmlDomParser.parse(html), null, domBenchDuration);
console.log('createXmlDomParser  ', tagSoupXmlDomResult);

gc();

const tagSoupHtmlDomParser = createHtmlDomParser({});
const tagSoupHtmlDomParserResult = bench(() => tagSoupHtmlDomParser.parse(html), null, domBenchDuration);
console.log('createHtmlDomParser ', tagSoupHtmlDomParserResult);

gc();

const htmlparser2DomParser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
const htmlparser2DomParserResult = bench(() => htmlparser2DomParser.end(html), null, domBenchDuration);
console.log('htmlparser2         ', htmlparser2DomParserResult);

gc();

const parse5ParserResult = bench(() => parse5.parse(html), null, domBenchDuration);
console.log('parse5              ', parse5ParserResult);

console.log(`
createXmlDomParser
  ${round(htmlparser2DomParserResult.mean / tagSoupXmlDomResult.mean)}✕ faster than htmlparser2
  ${round(parse5ParserResult.mean / tagSoupXmlDomResult.mean)}✕ faster than parse5

createHtmlDomParser
  ${round(htmlparser2DomParserResult.mean / tagSoupHtmlDomParserResult.mean)}✕ faster htmlparser2 
  ${round(parse5ParserResult.mean / tagSoupHtmlDomParserResult.mean)}✕ faster than parse5
`);
