import { afterIteration, beforeBatch, beforeIteration, describe, measure, test } from 'toofast';
import path from 'node:path';
import fs from 'node:fs';
import * as htmlparser2 from 'htmlparser2';
import * as parse5 from 'parse5';
import * as parse5SAXParser from 'parse5-sax-parser';
import * as hyntax from 'hyntax';
import * as fastXmlParser from 'fast-xml-parser';
import * as tagSoup from '../../lib/index.js';

const filesDir = path.resolve(import.meta.dirname, '../../node_modules/htmlparser-benchmark/files');

const smallHtmlSources = fs
  .readdirSync(filesDir)
  .map(fileName => fs.readFileSync(path.join(filesDir, fileName), 'utf8'));

const largeHtmlSource = fs.readFileSync(path.resolve(import.meta.dirname, 'test.html'), 'utf8');

const xmlSource = fs.readFileSync(path.resolve(import.meta.dirname, 'test.xml'), 'utf8');

beforeBatch(() => {
  gc();
});

describe('HTML SAX (large source)', () => {
  test('tag-soup', () => {
    const saxHandler = {};

    measure(() => {
      tagSoup.HTMLSAXParser.parseDocument(largeHtmlSource, saxHandler);
    });
  });

  test('htmlparser2', () => {
    let parser;

    beforeBatch(() => {
      parser = new htmlparser2.Parser(
        {},
        {
          lowerCaseTags: false,
          lowerCaseAttributeNames: false,
        }
      );
    });

    afterIteration(() => {
      parser.reset();
    });

    measure(() => {
      parser.end(largeHtmlSource);
    });
  });

  test('parse5', () => {
    let parser;
    let transformCallback = () => undefined;

    beforeIteration(() => {
      parser = new parse5SAXParser.SAXParser();
    });

    measure(() => {
      parser._transform(largeHtmlSource, 'utf8', transformCallback);
    });
  });
});

describe('HTML DOM (large source)', () => {
  test('tag-soup', () => {
    measure(() => {
      tagSoup.HTMLDOMParser.parseDocument(largeHtmlSource);
    });
  });

  test('htmlparser2', () => {
    let parser;

    beforeBatch(() => {
      parser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null), {
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
      });
    });

    afterIteration(() => {
      parser.reset();
    });

    measure(() => {
      parser.end(largeHtmlSource);
    });
  });

  test('parse5', () => {
    measure(() => {
      parse5.parse(largeHtmlSource);
    });
  });

  test('hyntax', () => {
    measure(() => {
      hyntax.tokenize(largeHtmlSource);
    });
  });
});

describe('HTML SAX (small sources)', () => {
  test('tag-soup', () => {
    const saxHandler = {};

    for (const smallSource of smallHtmlSources) {
      measure(() => {
        tagSoup.HTMLSAXParser.parseDocument(smallSource, saxHandler);
      });
    }
  });

  test('htmlparser2', () => {
    let parser;

    beforeBatch(() => {
      parser = new htmlparser2.Parser(
        {},
        {
          lowerCaseTags: false,
          lowerCaseAttributeNames: false,
        }
      );
    });

    afterIteration(() => {
      parser.reset();
    });

    for (const smallSource of smallHtmlSources) {
      measure(() => {
        parser.end(smallSource);
      });
    }
  });
});

describe('HTML DOM (small sources)', () => {
  test('tag-soup', () => {
    for (const smallSource of smallHtmlSources) {
      measure(() => {
        tagSoup.HTMLDOMParser.parseDocument(smallSource);
      });
    }
  });

  test('htmlparser2', () => {
    let parser;

    beforeBatch(() => {
      parser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null), {
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
      });
    });

    afterIteration(() => {
      parser.reset();
    });

    for (const smallSource of smallHtmlSources) {
      measure(() => {
        parser.end(smallSource);
      });
    }
  });

  test('parse5', () => {
    for (const smallSource of smallHtmlSources) {
      measure(() => {
        parse5.parse(smallSource);
      });
    }
  });

  test('hyntax', () => {
    for (const smallSource of smallHtmlSources) {
      measure(() => {
        hyntax.tokenize(smallSource);
      });
    }
  });
});

describe('XML DOM', () => {
  test('tag-soup', () => {
    measure(() => {
      tagSoup.XMLDOMParser.parseDocument(xmlSource);
    });
  });

  test('fast-xml-parser', () => {
    const parser = new fastXmlParser.XMLParser();

    measure(() => {
      parser.parse(xmlSource);
    });
  });
});
