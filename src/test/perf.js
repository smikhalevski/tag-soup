const fs = require('fs');
const path = require('path');
const bench = require('nodemark');
const chalk = require('chalk');
const htmlparser2 = require('htmlparser2');
const readline = require('readline');
const sax = require('sax');
const parse5 = require('parse5');
const {
  createSaxParser,
  createDomParser,
  createXmlSaxParser,
  createXmlDomParser,
  domHandler,
} = require('../../lib/index-cjs');
const {createHtmlSaxParser, createHtmlDomParser} = require('../../lib/html-cjs');

const htmlDir = path.join(path.dirname(require.resolve('htmlparser-benchmark/package.json')), 'files');

const htmlparserBenchmarkSources = fs.readdirSync(htmlDir).map((fileName) => fs.readFileSync(path.join(htmlDir, fileName), 'utf8'));

const stressTestHtmlSource = fs.readFileSync(path.join(__dirname, './test.html'), 'utf8');

function test(htmlSources, label, cb, parser, timeout) {
  let hz;

  for (let i = 0; i < htmlSources.length; i++) {

    process.stdout.write(label + `${i}/${htmlSources.length} (${(i / htmlSources.length).toFixed(2)}%)`);
    readline.cursorTo(process.stdout, 0, null);

    const html = htmlSources[i];
    const result = bench(() => cb(parser, html), null, timeout);
    hz = hz != null ? (hz + result.hz(5)) / 2 : result.hz(5);

    if (i % 10 === 0) {
      global.gc();
    }
  }

  console.log(label + hz.toFixed(1) + ' ops/sec');
}

const handler = {
  startTag() {
  },
  endTag() {
  },
  text() {
  },
  comment() {
  },
  doctype() {
  },
  processingInstruction() {
  },
  cdata() {
  },
};

console.log(chalk.bgYellow.black.bold(' Stress test ') + '\n');

console.log(chalk.bold('SAX benchmark'));
console.log(chalk.dim('* handler without callbacks'));
test([stressTestHtmlSource], 'createSaxParser *     ', (parser, html) => parser.parse(html), createSaxParser({}), 5000);
test([stressTestHtmlSource], 'createXmlSaxParser *  ', (parser, html) => parser.parse(html), createXmlSaxParser({}), 5000);
test([stressTestHtmlSource], 'createHtmlSaxParser * ', (parser, html) => parser.parse(html), createHtmlSaxParser({}), 5000);
test([stressTestHtmlSource], 'createSaxParser       ', (parser, html) => parser.parse(html), createSaxParser(handler), 5000);
test([stressTestHtmlSource], 'createXmlSaxParser    ', (parser, html) => parser.parse(html), createXmlSaxParser(handler), 5000);
test([stressTestHtmlSource], 'createHtmlSaxParser   ', (parser, html) => parser.parse(html), createHtmlSaxParser(handler), 5000);
test([stressTestHtmlSource], 'htmlparser2           ', (parser, html) => parser.end(html), new htmlparser2.Parser(), 5000);
test([stressTestHtmlSource], 'sax                   ', (parser, html) => parser.write(html), sax.parser(), 5000);

console.log(chalk.bold('\nDOM benchmark'));

test([stressTestHtmlSource], 'createDomParser       ', (parser, html) => parser.parse(html), createDomParser(domHandler), 5000);
test([stressTestHtmlSource], 'createXmlDomParser    ', (parser, html) => parser.parse(html), createXmlDomParser(domHandler), 5000);
test([stressTestHtmlSource], 'createHtmlDomParser   ', (parser, html) => parser.parse(html), createHtmlDomParser(domHandler), 5000);
test([stressTestHtmlSource], 'htmlparser2           ', (parser, html) => parser.end(html), new htmlparser2.Parser(new htmlparser2.DomHandler(() => null)), 5000);
test([stressTestHtmlSource], 'parse5                ', () => parse5.parse(stressTestHtmlSource), null, 5000);


console.log('\n' + chalk.bgYellow.black.bold(' Average test ') + '\n');

console.log(chalk.bold('SAX benchmark'));

test(htmlparserBenchmarkSources, 'createSaxParser       ', (parser, html) => parser.parse(html), createSaxParser(handler), 500);
test(htmlparserBenchmarkSources, 'createXmlSaxParser    ', (parser, html) => parser.parse(html), createXmlSaxParser(handler), 500);
test(htmlparserBenchmarkSources, 'createHtmlSaxParser   ', (parser, html) => parser.parse(html), createHtmlSaxParser(handler), 500);
test(htmlparserBenchmarkSources, 'htmlparser2           ', (parser, html) => parser.end(html), new htmlparser2.Parser(), 500);

console.log(chalk.bold('\nDOM benchmark'));

test(htmlparserBenchmarkSources, 'createDomParser       ', (parser, html) => parser.parse(html), createDomParser(domHandler), 500);
test(htmlparserBenchmarkSources, 'createXmlDomParser    ', (parser, html) => parser.parse(html), createXmlDomParser(domHandler), 500);
test(htmlparserBenchmarkSources, 'createHtmlDomParser   ', (parser, html) => parser.parse(html), createHtmlDomParser(domHandler), 500);
test(htmlparserBenchmarkSources, 'htmlparser2           ', (parser, html) => parser.end(html), new htmlparser2.Parser(new htmlparser2.DomHandler(() => null)), 500);
test(htmlparserBenchmarkSources, 'parse5                ', () => parse5.parse(stressTestHtmlSource), null, 500);
