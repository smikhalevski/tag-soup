const fs = require('fs');
const path = require('path');
const Benchmark = require('benchmark');
const htmlparser2 = require('htmlparser2');
const {padEnd, padStart} = require('lodash');
const {createSaxParser, createForgivingSaxParser} = require('../../lib');
const {createHtmlSaxParser, createHtmlTagSoupDomParser} = require('../../lib/html');

const html = fs.readFileSync(path.join(__dirname, './test.html'), {encoding: 'utf8'});

const suite = new Benchmark.Suite;

suite.on('complete', () => {
  const benches = Array.from(suite);

  for (const bench of benches) {
    const ms = bench.stats.mean * 1000;
    console.log(padEnd(bench.name, 25) + padStart(ms.toFixed(2), 8) + 'ms ± ' + bench.stats.rme.toFixed() + '%');
  }

  // console.log('\nSAX perf ratio = ' + (benches[0].stats.mean / benches[1].stats.mean).toFixed(2));
  // console.log('forgiving SAX perf ratio = ' + (benches[0].stats.mean / benches[2].stats.mean).toFixed(2));
  // console.log('HTML SAX perf ratio = ' + (benches[0].stats.mean / benches[3].stats.mean).toFixed(2));
  // console.log('DOM perf ratio = ' + (benches[4].stats.mean / benches[5].stats.mean).toFixed(2));
});

const htmlparser2SaxParser = new htmlparser2.Parser({});
suite.add('htmlparser2 SAX', () => {
  htmlparser2SaxParser.write(html);
});

// const saxParser = createSaxParser({
//   onStartTag: () => undefined,
//   onAttribute: () => undefined,
//   onEndTag: () => undefined,
//   onText: () => undefined,
//   onComment: () => undefined,
//   onProcessingInstruction: () => undefined,
//   onCdata: () => undefined,
//   onDtd: () => undefined,
// });
// suite.add('tag-soup SAX', () => {
//   saxParser.commit(html);
// });
//
// const forgivingSaxParser = createForgivingSaxParser({
//   onStartTag: () => undefined,
//   onAttribute: () => undefined,
//   onEndTag: () => undefined,
//   onText: () => undefined,
//   onComment: () => undefined,
//   onProcessingInstruction: () => undefined,
//   onCdata: () => undefined,
//   onDtd: () => undefined,
// });
// suite.add('tag-soup forgiving SAX', () => {
//   forgivingSaxParser.commit(html);
// });

const htmlSaxParser = createHtmlSaxParser({
  onStartTag: () => undefined,
  onAttribute: () => undefined,
  onEndTag: () => undefined,
  onText: () => undefined,
  onComment: () => undefined,
  onProcessingInstruction: () => undefined,
  onCdata: () => undefined,
  onDtd: () => undefined,
});
suite.add('tag-soup HTML SAX', () => {
  htmlSaxParser.commit(html);
});

// const htmlparser2DomParser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
// suite.add('htmlparser2 DOM', () => {
//   htmlparser2DomParser.write(html);
// });
//
// const htmlTagSoupDomParser = createHtmlTagSoupDomParser();
// suite.add('tag-soup DOM', () => {
//   htmlTagSoupDomParser.commit(html);
// });

suite.run();
