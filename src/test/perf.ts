import fs from 'node:fs';
import * as fastXmlParser from 'fast-xml-parser';
import * as htmlparser2 from 'htmlparser2';
import * as hyntax from 'hyntax';
import * as parse5 from 'parse5';
import * as parse5SAXParser from 'parse5-sax-parser';
import { afterIteration, beforeBatch, beforeIteration, describe, measure, test } from 'toofast';
// @ts-ignore
import * as tagSoup from '../../lib/index.js';
import { collectGarbage } from './test-utils.ts';

const filesDir = new URL('../../node_modules/htmlparser-benchmark/files/', import.meta.url);

const smallHtmlSources = fs.readdirSync(filesDir).map(fileName => fs.readFileSync(new URL(fileName, filesDir), 'utf8'));

const largeHtmlSource = fs.readFileSync(new URL('test.html', import.meta.url), 'utf8');

const xmlSource = fs.readFileSync(new URL('test.xml', import.meta.url), 'utf8');

beforeBatch(collectGarbage);

describe('HTML SAX (large source)', () => {
  test('tag-soup', () => {
    const saxHandler = {};

    measure(() => {
      tagSoup.HTMLSAXParser.parseDocument(largeHtmlSource, saxHandler);
    });
  });

  test('htmlparser2', () => {
    let parser: htmlparser2.Parser;

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
    let parser: parse5SAXParser.SAXParser;
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
    let parser: htmlparser2.Parser;

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
    let parser: htmlparser2.Parser;

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
    let parser: htmlparser2.Parser;

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
