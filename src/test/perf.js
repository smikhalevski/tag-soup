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
const {createHtmlSaxParser, createHtmlDomParser} = require('../../lib/index-cjs');
const {decodeHtml} = require('speedy-entities/lib/full-cjs');

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

const afterCycle = (cycleCount) => {
  if (cycleCount % 3 === 0) {
    global.gc();
  }
};

console.log(chalk.inverse(' Large input ') + '\n');

console.log(chalk.bold('SAX benchmark'));

const textSaxParser = createSaxParser(textHandler);
const textXmlSaxParser = createXmlSaxParser(textHandler);
const textHtmlSaxParser = createHtmlSaxParser(textHandler);
const fullSaxParser1 = createSaxParser(fullHandler);
const fullXmlSaxParser1 = createXmlSaxParser(fullHandler);
const fullHtmlSaxParser1 = createHtmlSaxParser(fullHandler);
const fullHtmlSaxParser2 = createHtmlSaxParser(fullHandler, {decodeText: decodeHtml, decodeAttribute: decodeHtml});

const htmlparserSaxParser1 = new htmlparser2.Parser();
const saxParser = sax.parser();

test('createSaxParser     (text)', () => textSaxParser.parse(largeHtmlSource), {timeout: 10000});
afterCycle();
test('createXmlSaxParser  (text)', () => textXmlSaxParser.parse(largeHtmlSource), {timeout: 10000});
afterCycle();
test('createHtmlSaxParser (text)', () => textHtmlSaxParser.parse(largeHtmlSource), {timeout: 10000});
afterCycle();
test('createSaxParser           ', () => fullSaxParser1.parse(largeHtmlSource), {timeout: 20000});
afterCycle();
test('createXmlSaxParser        ', () => fullXmlSaxParser1.parse(largeHtmlSource), {timeout: 20000});
afterCycle();
test('createHtmlSaxParser       ', () => fullHtmlSaxParser1.parse(largeHtmlSource), {timeout: 20000});
afterCycle();
test('createHtmlSaxParser (full)', () => fullHtmlSaxParser2.parse(largeHtmlSource), {timeout: 20000});
test('htmlparser2               ', () => htmlparserSaxParser1.end(largeHtmlSource), {timeout: 30000, afterCycle});
test('sax                       ', () => saxParser.write(largeHtmlSource), {timeout: 30000, afterCycle});

console.log(chalk.bold('\nDOM benchmark'));

const domParser1 = createDomParser(domHandler);
const xmlDomParser1 = createXmlDomParser(domHandler);
const htmlDomParser1 = createHtmlDomParser(domHandler);

let htmlparserDomParser1;

test('createDomParser    ', () => domParser1.parse(largeHtmlSource), {timeout: 120000, afterCycle});
test('createXmlDomParser ', () => xmlDomParser1.parse(largeHtmlSource), {timeout: 120000, afterCycle});
test('createHtmlDomParser', () => htmlDomParser1.parse(largeHtmlSource), {timeout: 120000, afterCycle});
test('htmlparser2        ', () => htmlparserDomParser1.end(largeHtmlSource), {
  timeout: 120000,

  // Have to re-create, out-of-memory otherwise
  beforeCycle: () => htmlparserDomParser1 = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null)),
  afterCycle,
});
test('parse5             ', () => parse5.parse(largeHtmlSource), {timeout: 120000, afterCycle});


console.log('\n' + chalk.inverse(' Small input ') + '\n');

console.log(chalk.bold('SAX benchmark'));

const saxParser2 = createSaxParser(fullHandler);
const xmlSaxParser2 = createXmlSaxParser(fullHandler);
const htmlSaxParser2 = createHtmlSaxParser(fullHandler);

let htmlparserSaxParser2;

afterCycle();
valueTest(htmlparserBenchmarkSources, 'createSaxParser    ', (value) => saxParser2.parse(value), {timeout: 4000, targetRme: 0});
afterCycle();
valueTest(htmlparserBenchmarkSources, 'createXmlSaxParser ', (value) => xmlSaxParser2.parse(value), {timeout: 4000, targetRme: 0});
afterCycle();
valueTest(htmlparserBenchmarkSources, 'createHtmlSaxParser', (value) => htmlSaxParser2.parse(value), {timeout: 4000, targetRme: 0});
valueTest(htmlparserBenchmarkSources, 'htmlparser2        ', (value) => htmlparserSaxParser2.end(value), {
  timeout: 6000,
  targetRme: 0,

  // Have to re-create, out-of-memory otherwise
  beforeCycle: () => htmlparserSaxParser2 = new htmlparser2.Parser(),
  afterCycle,
});

console.log(chalk.bold('\nDOM benchmark'));

const domParser2 = createDomParser(domHandler);
const xmlDomParser2 = createXmlDomParser(domHandler);
const htmlDomParser2 = createHtmlDomParser(domHandler);

let htmlparserDomParser2;

valueTest(htmlparserBenchmarkSources, 'createDomParser    ', (value) => domParser2.parse(value), {timeout: 6000, targetRme: 0, afterCycle});
valueTest(htmlparserBenchmarkSources, 'createXmlDomParser ', (value) => xmlDomParser2.parse(value), {timeout: 6000, targetRme: 0, afterCycle});
valueTest(htmlparserBenchmarkSources, 'createHtmlDomParser', (value) => htmlDomParser2.parse(value), {timeout: 6000, targetRme: 0, afterCycle});
valueTest(htmlparserBenchmarkSources, 'htmlparser2        ', (value) => htmlparserDomParser2.end(value), {
  timeout: 6000,
  targetRme: 0,

  // Have to re-create, out-of-memory otherwise
  beforeCycle: () => htmlparserDomParser2 = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null)),
  afterCycle
});
valueTest(htmlparserBenchmarkSources, 'parse5             ', (value) => parse5.parse(value), {timeout: 6000, targetRme: 0, afterCycle});
