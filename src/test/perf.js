const fs = require('fs');
const path = require('path');
const {test, valueTest} = require('@smikhalevski/perf-test');
const chalk = require('chalk');
const htmlparser2 = require('htmlparser2');
const sax = require('sax');
const parse5 = require('parse5');
const {
  domHandler,
  createSaxParser,
  createDomParser,
  createXmlSaxParser,
  createXmlDomParser,
} = require('../../lib/index-cjs');
const {createHtmlSaxParser, createHtmlDomParser} = require('../../lib/html-cjs');

const htmlparserBenchmarkDir = path.join(path.dirname(require.resolve('htmlparser-benchmark/package.json')), 'files');

const htmlparserBenchmarkSources = fs.readdirSync(htmlparserBenchmarkDir).map((fileName) => fs.readFileSync(path.join(htmlparserBenchmarkDir, fileName), 'utf8'));

const largeHtmlSource = fs.readFileSync(path.join(__dirname, './test.html'), 'utf8');

const textHandler = {
  text: () => undefined,
};

const fullHandler = {
  startTag: () => undefined,
  endTag: () => undefined,
  text: () => undefined,
  comment: () => undefined,
  doctype: () => undefined,
  processingInstruction: () => undefined,
  cdata: () => undefined,
};

const beforeCycle = () => global.gc();

console.log(chalk.inverse(' Large input ') + '\n');

console.log(chalk.bold('SAX benchmark'));

const textSaxParser = createSaxParser(textHandler);
const textXmlSaxParser = createXmlSaxParser(textHandler);
const textHtmlSaxParser = createHtmlSaxParser(textHandler);
const fullSaxParser1 = createSaxParser(fullHandler);
const fullXmlSaxParser1 = createXmlSaxParser(fullHandler);
const fullHtmlSaxParser1 = createHtmlSaxParser(fullHandler);

const htmlparserSaxParser1 = new htmlparser2.Parser();
const saxParser = sax.parser();

test('createSaxParser     (text only)', () => textSaxParser.parse(largeHtmlSource), {timeout: 10000});
test('createXmlSaxParser  (text only)', () => textXmlSaxParser.parse(largeHtmlSource), {timeout: 10000});
test('createHtmlSaxParser (text only)', () => textHtmlSaxParser.parse(largeHtmlSource), {timeout: 10000});
test('createSaxParser                ', () => fullSaxParser1.parse(largeHtmlSource), {timeout: 20000});
test('createXmlSaxParser             ', () => fullXmlSaxParser1.parse(largeHtmlSource), {timeout: 20000});
test('createHtmlSaxParser            ', () => fullHtmlSaxParser1.parse(largeHtmlSource), {timeout: 20000});
test('htmlparser2                    ', () => htmlparserSaxParser1.end(largeHtmlSource), {timeout: 30000, beforeCycle});
test('sax                            ', () => saxParser.write(largeHtmlSource), {timeout: 30000, beforeCycle});

// console.log(chalk.bold('\nDOM benchmark'));
//
// const domParser1 = createDomParser(domHandler);
// const xmlDomParser1 = createXmlDomParser(domHandler);
// const htmlDomParser1 = createHtmlDomParser(domHandler);
//
// const htmlparserDomParser1 = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
//
// test('createDomParser    ', () => domParser1.parse(largeHtmlSource), {timeout: 30000, beforeCycle});
// test('createXmlDomParser ', () => xmlDomParser1.parse(largeHtmlSource), {timeout: 30000, beforeCycle});
// test('createHtmlDomParser', () => htmlDomParser1.parse(largeHtmlSource), {timeout: 30000, beforeCycle});
// test('htmlparser2        ', () => htmlparserDomParser1.end(largeHtmlSource), {timeout: 30000, beforeCycle});
// test('parse5             ', () => parse5.parse(largeHtmlSource), {timeout: 30000, beforeCycle});
//
//
// console.log('\n' + chalk.inverse(' Small input ') + '\n');
//
// console.log(chalk.bold('SAX benchmark'));
//
// const saxParser2 = createSaxParser(fullHandler);
// const xmlSaxParser2 = createXmlSaxParser(fullHandler);
// const htmlSaxParser2 = createHtmlSaxParser(fullHandler);
//
// const htmlparserSaxParser2 = new htmlparser2.Parser();
//
// valueTest(htmlparserBenchmarkSources, 'createSaxParser    ', (value) => saxParser2.parse(value), {timeout: 1000, targetRme: 0});
// valueTest(htmlparserBenchmarkSources, 'createXmlSaxParser ', (value) => xmlSaxParser2.parse(value), {timeout: 1000, targetRme: 0});
// valueTest(htmlparserBenchmarkSources, 'createHtmlSaxParser', (value) => htmlSaxParser2.parse(value), {timeout: 1000, targetRme: 0});
// valueTest(htmlparserBenchmarkSources, 'htmlparser2        ', (value) => htmlparserSaxParser2.end(value), {timeout: 1000, targetRme: 0, beforeCycle});
//
// console.log(chalk.bold('\nDOM benchmark'));
//
// const domParser2 = createDomParser(domHandler);
// const xmlDomParser2 = createXmlDomParser(domHandler);
// const htmlDomParser2 = createHtmlDomParser(domHandler);
//
// const htmlparserDomParser2 = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
//
// valueTest(htmlparserBenchmarkSources, 'createDomParser    ', (value) => domParser2.parse(value), {timeout: 2000, targetRme: 0, beforeCycle});
// valueTest(htmlparserBenchmarkSources, 'createXmlDomParser ', (value) => xmlDomParser2.parse(value), {timeout: 2000, targetRme: 0, beforeCycle});
// valueTest(htmlparserBenchmarkSources, 'createHtmlDomParser', (value) => htmlDomParser2.parse(value), {timeout: 2000, targetRme: 0, beforeCycle});
// valueTest(htmlparserBenchmarkSources, 'htmlparser2        ', (value) => htmlparserDomParser2.end(value), {timeout: 2000, targetRme: 0, beforeCycle});
// valueTest(htmlparserBenchmarkSources, 'parse5             ', (value) => parse5.parse(value), {timeout: 2000, targetRme: 0, beforeCycle});
