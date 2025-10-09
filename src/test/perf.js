import { afterIteration, beforeBatch, describe, measure, test } from 'toofast';
import path from 'node:path';
import fs from 'node:fs';
import * as htmlparser2 from 'htmlparser2';
import * as parse5 from 'parse5';
import * as hyntax from 'hyntax';
import * as tagSoup from '../../lib/index.js';

const filesDir = path.resolve(import.meta.dirname, '../../node_modules/htmlparser-benchmark/files');

const smallSources = fs.readdirSync(filesDir).map(fileName => fs.readFileSync(path.join(filesDir, fileName), 'utf8'));

const largeSource = fs.readFileSync(path.resolve(import.meta.dirname, 'test.html'), 'utf8');

beforeBatch(() => {
  gc();
});

describe('SAX (large source)', () => {
  test('tag-soup', () => {
    const saxHandler = {};

    measure(() => {
      tagSoup.HTMLSAXParser.parseDocument(largeSource, saxHandler);
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
      parser.end(largeSource);
    });
  });
});

describe('DOM (large source)', () => {
  test('tag-soup', () => {
    measure(() => {
      tagSoup.HTMLDOMParser.parseDocument(largeSource);
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
      parser.end(largeSource);
    });
  });

  test('parse5', () => {
    measure(() => {
      parse5.parse(largeSource);
    });
  });

  test('hyntax', () => {
    measure(() => {
      hyntax.tokenize(largeSource);
    });
  });
});

describe('SAX (small sources)', () => {
  test('tag-soup', () => {
    const saxHandler = {};

    for (const smallSource of smallSources) {
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

    for (const smallSource of smallSources) {
      measure(() => {
        parser.end(smallSource);
      });
    }
  });
});

describe('DOM (small sources)', () => {
  test('tag-soup', () => {
    for (const smallSource of smallSources) {
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

    for (const smallSource of smallSources) {
      measure(() => {
        parser.end(smallSource);
      });
    }
  });

  test('parse5', () => {
    for (const smallSource of smallSources) {
      measure(() => {
        parse5.parse(smallSource);
      });
    }
  });

  test('hyntax', () => {
    for (const smallSource of smallSources) {
      measure(() => {
        hyntax.tokenize(smallSource);
      });
    }
  });
});
