const fs = require('fs');
const path = require('path');
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

const sourceFilesDir = path.join(path.dirname(require.resolve('htmlparser-benchmark/package.json')), 'files');

const smallSources = fs.readdirSync(sourceFilesDir).map((fileName) => fs.readFileSync(path.join(sourceFilesDir, fileName), 'utf8'));

const largeSource = fs.readFileSync(path.join(__dirname, './test.html'), 'utf8');

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


describe('Large input', () => {

  describe('SAX parser', () => {

    test('createSaxParser     (text)', (measure) => {
      const parser = createSaxParser(textHandler);

      measure(() => {
        parser.parse(largeSource);
      });
    });

    test('createXmlSaxParser  (text)', (measure) => {
      const parser = createXmlSaxParser(textHandler);

      measure(() => {
        parser.parse(largeSource);
      });
    });

    test('createHtmlSaxParser (text)', (measure) => {
      const parser = createHtmlSaxParser(textHandler);

      measure(() => {
        parser.parse(largeSource);
      });
    });

    test('createSaxParser', (measure) => {
      const parser = createSaxParser(fullHandler);

      measure(() => {
        parser.parse(largeSource);
      });
    });

    test('createXmlSaxParser', (measure) => {
      const parser = createXmlSaxParser(fullHandler);

      measure(() => {
        parser.parse(largeSource);
      });
    });

    test('createHtmlSaxParser', (measure) => {
      const parser = createHtmlSaxParser(fullHandler);

      measure(() => {
        parser.parse(largeSource);
      });
    });

    test('createHtmlSaxParser (full)', (measure) => {
      const parser = createHtmlSaxParser(fullHandler, {decodeText: decodeHtml, decodeAttribute: decodeHtml});

      measure(() => {
        parser.parse(largeSource);
      });
    });

    test('htmlparser2', (measure) => {
      let parser;

      beforeBatch(() => {
        parser = new htmlparser2.Parser();
      });

      afterIteration(() => {
        parser.reset();
      });

      measure(() => {
        parser.end(largeSource);
      });
    });

    test('sax', (measure) => {
      const parser = sax.parser();

      measure(() => {
        parser.write(largeSource);
      });
    });
  });

  describe('DOM parser', () => {

    test('createDomParser', (measure) => {
      const parser = createDomParser(domHandler);

      measure(() => {
        parser.parse(largeSource);
      });
    });

    test('createXmlDomParser', (measure) => {
      const parser = createXmlDomParser(domHandler);

      measure(() => {
        parser.parse(largeSource);
      });
    });

    test('createHtmlDomParser', (measure) => {
      const parser = createHtmlDomParser(domHandler);

      measure(() => {
        parser.parse(largeSource);
      });
    });

    test('htmlparser2', (measure) => {
      let parser;

      beforeBatch(() => {
        parser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
      });

      afterIteration(() => {
        parser.reset();
      });

      measure(() => {
        parser.end(largeSource);
      });
    });

    test('parse5', (measure) => {
      measure(() => {
        parse5.parse(largeSource);
      });
    });
  });

});


describe('Small input (average across ' + smallSources.length + ' samples)', () => {

  describe('SAX parser', () => {

    test('createSaxParser', (measure) => {
      const parser = createSaxParser(fullHandler);

      smallSources.forEach((value) => {
        measure(() => {
          parser.parse(value);
        });
      });
    });

    test('createXmlSaxParser', (measure) => {
      const parser = createXmlSaxParser(fullHandler);

      smallSources.forEach((value) => {
        measure(() => {
          parser.parse(value);
        });
      });
    });

    test('createHtmlSaxParser', (measure) => {
      const parser = createHtmlSaxParser(fullHandler);

      smallSources.forEach((value) => {
        measure(() => {
          parser.parse(value);
        });
      });
    });

    test('htmlparser2', (measure) => {
      let parser;

      beforeBatch(() => {
        parser = new htmlparser2.Parser();
      });

      afterIteration(() => {
        parser.reset();
      });

      smallSources.forEach((value) => {
        measure(() => {
          parser.end(value);
        });
      });
    });

  });

  describe('DOM parser', () => {

    test('createDomParser', (measure) => {
      const parser = createDomParser(domHandler);

      smallSources.forEach((value) => {
        measure(() => {
          parser.parse(value);
        });
      });
    });

    test('createXmlDomParser', (measure) => {
      const parser = createXmlDomParser(domHandler);

      smallSources.forEach((value) => {
        measure(() => {
          parser.parse(value);
        });
      });
    });

    test('createHtmlDomParser', (measure) => {
      const parser = createHtmlDomParser(domHandler);

      smallSources.forEach((value) => {
        measure(() => {
          parser.parse(value);
        });
      });
    });

    test('htmlparser2', (measure) => {
      let parser;

      beforeBatch(() => {
        parser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
      });

      afterIteration(() => {
        parser.reset();
      });

      smallSources.forEach((value) => {
        measure(() => {
          parser.end(value);
        });
      });
    });

    test('parse5', (measure) => {
      smallSources.forEach((value) => {
        measure(() => {
          parse5.parse(value);
        });
      });
    });

  });

});
