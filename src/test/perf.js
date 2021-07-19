const fs = require('fs');
const path = require('path');
const bench = require('nodemark');
const chalk = require('chalk');
const htmlparser2 = require('htmlparser2');
const readline = require('readline');
const sax = require('sax');
const parse5 = require('parse5');
const {createSaxParser, createDomParser, createXmlSaxParser, createXmlDomParser, cheerioDomHandler, domHandler} = require('../../lib/index-cjs');
const {createHtmlSaxParser, createHtmlDomParser} = require('../../lib/html-cjs');

const htmlDir = path.join(path.dirname(require.resolve('htmlparser-benchmark/package.json')), 'files');

const htmlSamples = fs.readdirSync(htmlDir).map((fileName) => fs.readFileSync(path.join(htmlDir, fileName), 'utf8'))

.slice(0, 20)


const html = fs.readFileSync(path.join(__dirname, './test.html'), 'utf8');

function test(label, cb, parser, timeout) {

  console.log(label, bench(() => cb(parser, html), null, timeout));
  global.gc();

  // let hz;
  //
  // for (let i = 0; i< htmlSamples.length; i++) {
  //
  //   process.stdout.write(label + `${i}/${htmlSamples.length} (${(i / htmlSamples.length).toFixed(2)}%)`);
  //   readline.cursorTo(process.stdout, 0, null);
  //
  //   const html = htmlSamples[i];
  //   const result = bench(() => cb(parser, html), null, timeout);
  //   hz = hz != null ? (hz + result.hz(5)) / 2 : result.hz(5);
  //
  //   if (i % 10 === 0) {
  //     global.gc();
  //   }
  // }
  //
  // console.log(label + hz.toFixed(1) + ' ops/sec');
}

console.log(chalk.bold('SAX benchmark'));

test('createSaxParser     ', (parser, html) => parser.parse({}, html), createSaxParser(), 5000);
// test('createXmlSaxParser  ', (parser, html) => parser.parse({}, html), createXmlSaxParser({}), 5000);
// test('createHtmlSaxParser ', (parser, html) => parser.parse({}, html), createHtmlSaxParser({}), 5000);
test('htmlparser2         ', (parser, html) => parser.end(html), new htmlparser2.Parser({}), 5000);
test('sax                 ', (parser, html) => parser.write(html), sax.parser(), 5000);

console.log(chalk.bold('\nDOM benchmark'));

test('createDomParser     ', (parser, html) => parser.parse(domHandler, html), createDomParser(), 5000);
// test('createXmlDomParser  ', (parser, html) => parser.parse(domHandler, html), createXmlDomParser(), 5000);
// test('createHtmlDomParser ', (parser, html) => parser.parse(domHandler, html), createHtmlDomParser(), 5000);
test('htmlparser2         ', (parser, html) => parser.end(html), new htmlparser2.Parser(new htmlparser2.DomHandler(() => null)), 5000);
test('parse5              ', () => parse5.parse(html), null, 5000);
