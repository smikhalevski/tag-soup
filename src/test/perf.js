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
{
  const textSaxParser = createSaxParser(textHandler);
  const textXmlSaxParser = createXmlSaxParser(textHandler);
  const textHtmlSaxParser = createHtmlSaxParser(textHandler);
  const fullSaxParser = createSaxParser(fullHandler);
  const fullXmlSaxParser = createXmlSaxParser(fullHandler);
  const fullHtmlSaxParser1 = createHtmlSaxParser(fullHandler);
  const fullHtmlSaxParser2 = createHtmlSaxParser(fullHandler, {decodeText: decodeHtml, decodeAttribute: decodeHtml});

  const htmlparserSaxParser = new htmlparser2.Parser();
  const saxParser = sax.parser();

  test('createSaxParser     (text)', () => textSaxParser.parse(largeHtmlSource), {timeout: 10000});
  afterCycle();
  test('createXmlSaxParser  (text)', () => textXmlSaxParser.parse(largeHtmlSource), {timeout: 10000});
  afterCycle();
  test('createHtmlSaxParser (text)', () => textHtmlSaxParser.parse(largeHtmlSource), {timeout: 10000});
  afterCycle();
  test('createSaxParser           ', () => fullSaxParser.parse(largeHtmlSource), {timeout: 20000});
  afterCycle();
  test('createXmlSaxParser        ', () => fullXmlSaxParser.parse(largeHtmlSource), {timeout: 20000});
  afterCycle();
  test('createHtmlSaxParser       ', () => fullHtmlSaxParser1.parse(largeHtmlSource), {timeout: 20000});
  afterCycle();
  test('createHtmlSaxParser (full)', () => fullHtmlSaxParser2.parse(largeHtmlSource), {timeout: 20000});
  test('htmlparser2               ', () => htmlparserSaxParser.end(largeHtmlSource), {timeout: 30000, afterCycle});
  test('sax                       ', () => saxParser.write(largeHtmlSource), {timeout: 30000, afterCycle});
}

console.log(chalk.bold('\nDOM benchmark'));
{
  const domParser = createDomParser(domHandler);
  const xmlDomParser = createXmlDomParser(domHandler);
  const htmlDomParser = createHtmlDomParser(domHandler);

  let htmlparserDomParser;

  test('createDomParser    ', () => domParser.parse(largeHtmlSource), {timeout: 120000, afterCycle});
  test('createXmlDomParser ', () => xmlDomParser.parse(largeHtmlSource), {timeout: 120000, afterCycle});
  test('createHtmlDomParser', () => htmlDomParser.parse(largeHtmlSource), {timeout: 120000, afterCycle});
  test('htmlparser2        ', () => htmlparserDomParser.end(largeHtmlSource), {
    timeout: 120000,

    // Have to re-create, out-of-memory otherwise
    beforeCycle: () => htmlparserDomParser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null)),
    afterCycle,
  });
  test('parse5             ', () => parse5.parse(largeHtmlSource), {timeout: 120000, afterCycle});
}

console.log('\n' + chalk.inverse(' Small input ') + '\n');

console.log(chalk.bold('SAX benchmark'));
{
  const saxParser = createSaxParser(fullHandler);
  const xmlSaxParser = createXmlSaxParser(fullHandler);
  const htmlSaxParser = createHtmlSaxParser(fullHandler);

  let htmlparserSaxParser;

  afterCycle();
  valueTest(htmlparserBenchmarkSources, 'createSaxParser    ', (value) => saxParser.parse(value), {timeout: 4000, targetRme: 0});
  afterCycle();
  valueTest(htmlparserBenchmarkSources, 'createXmlSaxParser ', (value) => xmlSaxParser.parse(value), {timeout: 4000, targetRme: 0});
  afterCycle();
  valueTest(htmlparserBenchmarkSources, 'createHtmlSaxParser', (value) => htmlSaxParser.parse(value), {timeout: 4000, targetRme: 0});
  valueTest(htmlparserBenchmarkSources, 'htmlparser2        ', (value) => htmlparserSaxParser.end(value), {
    timeout: 6000,
    targetRme: 0,

    // Have to re-create, out-of-memory otherwise
    beforeCycle: () => htmlparserSaxParser = new htmlparser2.Parser(),
    afterCycle,
  });
}

console.log(chalk.bold('\nDOM benchmark'));
{
  const domParser = createDomParser(domHandler);
  const xmlDomParser = createXmlDomParser(domHandler);
  const htmlDomParser = createHtmlDomParser(domHandler);

  let htmlparserDomParser;

  valueTest(htmlparserBenchmarkSources, 'createDomParser    ', (value) => domParser.parse(value), {timeout: 6000, targetRme: 0, afterCycle});
  valueTest(htmlparserBenchmarkSources, 'createXmlDomParser ', (value) => xmlDomParser.parse(value), {timeout: 6000, targetRme: 0, afterCycle});
  valueTest(htmlparserBenchmarkSources, 'createHtmlDomParser', (value) => htmlDomParser.parse(value), {timeout: 6000, targetRme: 0, afterCycle});
  valueTest(htmlparserBenchmarkSources, 'htmlparser2        ', (value) => htmlparserDomParser.end(value), {
    timeout: 6000,
    targetRme: 0,

    // Have to re-create, out-of-memory otherwise
    beforeCycle: () => htmlparserDomParser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null)),
    afterCycle
  });
  valueTest(htmlparserBenchmarkSources, 'parse5             ', (value) => parse5.parse(value), {timeout: 6000, targetRme: 0, afterCycle});
}
