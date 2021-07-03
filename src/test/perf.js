const fs = require('fs');
const path = require('path');
const bench = require('nodemark');
const chalk = require('chalk');
const htmlparser2 = require('htmlparser2');
const sax = require('sax');
const parse5 = require('parse5');
const {createSaxParser, createForgivingSaxParser, createXmlDomParser} = require('../../lib/index-cjs');
const {createHtmlSaxParser, createHtmlDomParser} = require('../../lib/html-cjs');

const html = fs.readFileSync(path.join(__dirname, './test.html'), 'utf8');

function test(label, cb, parser, timeout) {
  console.log(label, bench(() => cb(parser), null, timeout));
  global.gc();
}

console.log(chalk.bold(`Streaming benchmark`));

test('createSaxParser          ', (parser) => parser.parse(html), createSaxParser({}), 10_000);
test('createForgivingSaxParser ', (parser) => parser.parse(html), createForgivingSaxParser({}), 10_000);
test('createHtmlSaxParser      ', (parser) => parser.parse(html), createHtmlSaxParser({}), 10_000);
test('htmlparser2              ', (parser) => parser.end(html), new htmlparser2.Parser({}), 10_000);
test('sax                      ', (parser) => parser.write(html), sax.parser(), 10_000);

console.log(chalk.bold(`\nDOM benchmark`));

test('createXmlDomParser  ', (parser) => parser.parse(html), createXmlDomParser({}), 60_000);
test('createHtmlDomParser ', (parser) => parser.parse(html), createHtmlDomParser({}), 60_000);
test('htmlparser2         ', (parser) => parser.end(html), new htmlparser2.Parser(new htmlparser2.DomHandler(() => null)), 10_000);
test('parse5              ', () => parse5.parse(html), null, 60_000);
