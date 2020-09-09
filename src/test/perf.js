const fs = require('fs');
const path = require('path');
const Benchmark = require('benchmark');
const htmlparser2 = require('htmlparser2');
const {padEnd, padStart} = require('lodash');
const {createSaxParser, createXmlDomParser} = require('../../lib');
const {createHtmlSaxParser, createHtmlDomParser} = require('../../lib/html');

const html = fs.readFileSync(path.join(__dirname, './test.html'), {encoding: 'utf8'});

const suite = new Benchmark.Suite;

suite.on('complete', () => {
  const benches = Array.from(suite);

  for (const bench of benches) {
    const ms = bench.stats.mean * 1000;
    console.log(padEnd(bench.name, 40) + padStart(ms.toFixed(2), 8) + 'ms ± ' + bench.stats.rme.toFixed() + '%');
  }

  console.log('\nSAX XML  ratio = ' + (benches[0].stats.mean / benches[1].stats.mean).toFixed(2));
  console.log('SAX HTML ratio = ' + (benches[0].stats.mean / benches[2].stats.mean).toFixed(2));

  console.log('\nDOM XML  ratio = ' + (benches[3].stats.mean / benches[4].stats.mean).toFixed(2));
  console.log('DOM HTML ratio = ' + (benches[3].stats.mean / benches[5].stats.mean).toFixed(2));
});

// 0
const htmlparser2SaxParser = new htmlparser2.Parser({});
suite.add('SAX htmlparser2', () => {
  htmlparser2SaxParser.write(html);
});

// 1
const xmlSaxParser = createSaxParser({});
suite.add('SAX XML  tag-soup (createSaxParser)', () => {
  xmlSaxParser.commit(html);
});

// 2
const htmlSaxParser = createHtmlSaxParser({});
suite.add('SAX HTML tag-soup (createHtmlSaxParser)', () => {
  htmlSaxParser.commit(html);
});

// 3
const htmlparser2DomParser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
suite.add('DOM htmlparser2', () => {
  htmlparser2DomParser.write(html);
});

// 4
const xmlDomParser = createXmlDomParser();
suite.add('DOM XML  tag-soup (createXmlDomParser)', () => {
  xmlDomParser.commit(html);
});

// 5
const htmlDomParser = createHtmlDomParser();
suite.add('DOM HTML tag-soup (createHtmlDomParser)', () => {
  htmlDomParser.commit(html);
});

suite.run();
