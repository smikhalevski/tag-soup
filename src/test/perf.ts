import fs from 'node:fs';
import * as fastXmlParser from 'fast-xml-parser';
import * as htmlparser2 from 'htmlparser2';
import * as hyntax from 'hyntax';
import * as nodeHTMLParser from 'node-html-parser';
import * as parse5 from 'parse5';
import * as parse5SAXParser from 'parse5-sax-parser';
import * as saxWasm from 'sax-wasm';
import { beforeBatch, describe, measure, test } from 'toofast';
import * as tagSoup from '../../lib/index.js';
import { collectGarbage } from './perf-utils.ts';

const filesDir = new URL('../../node_modules/htmlparser-benchmark/files/', import.meta.url);

const smallHtmlSources = fs.readdirSync(filesDir).map(fileName => fs.readFileSync(new URL(fileName, filesDir), 'utf8'));

const largeHtmlSource = fs.readFileSync(new URL('test_large.html', import.meta.url), 'utf8');

const largeXmlSource = fs.readFileSync(new URL('test_large.xml', import.meta.url), 'utf8');

const smallXmlSource = fs.readFileSync(new URL('test_small.xml', import.meta.url), 'utf8');

// The size of chunks that streams usually emit, in bytes
const chunkSize = 65_536;

const noop = () => {};

const noopTokenHandler: tagSoup.TokenHandler = {
  onText: noop,
  onStartTagName: noop,
  onStartTagClosing: noop,
  onStartTagSelfClosing: noop,
  onEndTagName: noop,
  onAttribute: noop,
  onComment: noop,
  onProcessingInstruction: noop,
  onCDATASection: noop,
  onDoctype: noop,
};

beforeBatch(collectGarbage);

describe('HTML tokenizer (large source)', () => {
  test('tag-soup', () => {
    measure(() => {
      tagSoup.HTMLTokenizer.tokenizeDocument(largeHtmlSource, noopTokenHandler);
    });
  });

  test('htmlparser2', () => {
    // Entities aren't decoded, since tag-soup tokenizer doesn't decode them either
    const tokenizer = new htmlparser2.Tokenizer({ decodeEntities: false }, createTokenizerCallbacks());

    measure(() => {
      tokenizer.reset();
      tokenizer.write(largeHtmlSource);
      tokenizer.end();
    });
  });

  test('hyntax', () => {
    measure(() => {
      hyntax.tokenize(largeHtmlSource);
    });
  });
});

describe('HTML SAX (large source, without handlers)', () => {
  test('tag-soup', () => {
    const saxHandler: tagSoup.SAXHandler = {};

    measure(() => {
      tagSoup.HTMLSAXParser.parseDocument(largeHtmlSource, saxHandler);
    });
  });

  test('htmlparser2', () => {
    let parser: htmlparser2.Parser;

    beforeBatch(() => {
      parser = new htmlparser2.Parser({});
    });

    measure(() => {
      parser.reset();
      parser.end(largeHtmlSource);
    });
  });

  test('parse5', () => {
    const transformCallback = () => undefined;

    measure(() => {
      const parser = new parse5SAXParser.SAXParser();

      parser._transform(largeHtmlSource, 'utf8', transformCallback);
    });
  });

  test('sax-wasm', async () => {
    const parser = await createSAXWasmParser(0);
    const chunks = splitIntoByteChunks(largeHtmlSource);

    measure(() => {
      writeSAXWasmChunks(parser, chunks);
    });
  });
});

describe('HTML SAX (large source, with handlers)', () => {
  test('tag-soup', () => {
    const saxHandler: tagSoup.SAXHandler = {
      onStartTag: noop,
      onEndTag: noop,
      onText: noop,
    };

    measure(() => {
      tagSoup.HTMLSAXParser.parseDocument(largeHtmlSource, saxHandler);
    });
  });

  test('htmlparser2', () => {
    let parser: htmlparser2.Parser;

    beforeBatch(() => {
      parser = new htmlparser2.Parser({
        onopentag: noop,
        onclosetag: noop,
        ontext: noop,
      });
    });

    measure(() => {
      parser.reset();
      parser.end(largeHtmlSource);
    });
  });

  test('parse5', () => {
    const transformCallback = () => undefined;

    measure(() => {
      const parser = new parse5SAXParser.SAXParser();

      parser.on('startTag', noop);
      parser.on('endTag', noop);
      parser.on('text', noop);
      parser._transform(largeHtmlSource, 'utf8', transformCallback);
    });
  });

  test('sax-wasm', async () => {
    const parser = await createSAXWasmParserWithHandlers();
    const chunks = splitIntoByteChunks(largeHtmlSource);

    measure(() => {
      writeSAXWasmChunks(parser, chunks);
    });
  });
});

describe('HTML SAX (large source, chunks, with handlers)', () => {
  test('tag-soup', () => {
    const saxHandler: tagSoup.SAXHandler = {
      onStartTag: noop,
      onEndTag: noop,
      onText: noop,
    };
    const chunks = splitIntoTextChunks(largeHtmlSource);

    measure(() => {
      const writer = tagSoup.HTMLSAXParser.createDocumentWriter(saxHandler);

      for (const chunk of chunks) {
        writer.write(chunk);
      }
      writer.end();
    });
  });

  test('htmlparser2', () => {
    let parser: htmlparser2.Parser;
    const chunks = splitIntoTextChunks(largeHtmlSource);

    beforeBatch(() => {
      parser = new htmlparser2.Parser({
        onopentag: noop,
        onclosetag: noop,
        ontext: noop,
      });
    });

    measure(() => {
      parser.reset();
      for (const chunk of chunks) {
        parser.write(chunk);
      }
      parser.end();
    });
  });

  test('sax-wasm', async () => {
    const parser = await createSAXWasmParserWithHandlers();
    const chunks = splitIntoByteChunks(largeHtmlSource);

    measure(() => {
      writeSAXWasmChunks(parser, chunks);
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
      parser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
    });

    measure(() => {
      parser.reset();
      parser.end(largeHtmlSource);
    });
  });

  test('parse5', () => {
    measure(() => {
      parse5.parse(largeHtmlSource);
    });
  });

  test('node-html-parser', () => {
    measure(() => {
      nodeHTMLParser.parse(largeHtmlSource);
    });
  });
});

describe('HTML DOM (large source, chunks)', () => {
  test('tag-soup', () => {
    const chunks = splitIntoTextChunks(largeHtmlSource);

    measure(() => {
      const writer = tagSoup.HTMLDOMParser.createDocumentWriter();

      for (const chunk of chunks) {
        writer.write(chunk);
      }
      writer.end();
    });
  });

  test('htmlparser2', () => {
    let parser: htmlparser2.Parser;
    const chunks = splitIntoTextChunks(largeHtmlSource);

    beforeBatch(() => {
      parser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
    });

    measure(() => {
      parser.reset();
      for (const chunk of chunks) {
        parser.write(chunk);
      }
      parser.end();
    });
  });
});

describe('HTML serializer (large source)', () => {
  test('tag-soup', () => {
    const document = tagSoup.HTMLDOMParser.parseDocument(largeHtmlSource);

    measure(() => {
      tagSoup.toHTML(document);
    });
  });

  test('parse5', () => {
    const document = parse5.parse(largeHtmlSource);

    measure(() => {
      parse5.serialize(document);
    });
  });

  test('node-html-parser', () => {
    const root = nodeHTMLParser.parse(largeHtmlSource);

    measure(() => {
      root.toString();
    });
  });
});

describe('HTML SAX (small sources, with handlers)', { measureTimeout: 1_500, batchTimeout: 300 }, () => {
  test('tag-soup', () => {
    const saxHandler: tagSoup.SAXHandler = {
      onStartTag: noop,
      onEndTag: noop,
      onText: noop,
    };

    for (const smallSource of smallHtmlSources) {
      measure(() => {
        tagSoup.HTMLSAXParser.parseDocument(smallSource, saxHandler);
      });
    }
  });

  test('htmlparser2', () => {
    let parser: htmlparser2.Parser;

    beforeBatch(() => {
      parser = new htmlparser2.Parser({
        onopentag: noop,
        onclosetag: noop,
        ontext: noop,
      });
    });

    for (const smallSource of smallHtmlSources) {
      measure(() => {
        parser.reset();
        parser.end(smallSource);
      });
    }
  });

  test('sax-wasm', async () => {
    const parser = await createSAXWasmParserWithHandlers();

    for (const smallSource of smallHtmlSources) {
      const chunks = splitIntoByteChunks(smallSource);

      measure(() => {
        writeSAXWasmChunks(parser, chunks);
      });
    }
  });
});

describe('HTML DOM (small sources)', { measureTimeout: 1_500, batchTimeout: 300 }, () => {
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
      parser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null));
    });

    for (const smallSource of smallHtmlSources) {
      measure(() => {
        parser.reset();
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

  test('node-html-parser', () => {
    for (const smallSource of smallHtmlSources) {
      measure(() => {
        nodeHTMLParser.parse(smallSource);
      });
    }
  });
});

describe('XML SAX (with handlers)', () => {
  test('tag-soup', () => {
    const saxHandler: tagSoup.SAXHandler = {
      onStartTag: noop,
      onEndTag: noop,
      onText: noop,
    };

    measure(() => {
      tagSoup.XMLSAXParser.parseDocument(smallXmlSource, saxHandler);
    });
  });

  test('htmlparser2', () => {
    let parser: htmlparser2.Parser;

    beforeBatch(() => {
      parser = new htmlparser2.Parser(
        {
          onopentag: noop,
          onclosetag: noop,
          ontext: noop,
        },
        {
          xmlMode: true,
        }
      );
    });

    measure(() => {
      parser.reset();
      parser.end(smallXmlSource);
    });
  });

  test('sax-wasm', async () => {
    const parser = await createSAXWasmParserWithHandlers();
    const chunks = splitIntoByteChunks(smallXmlSource);

    measure(() => {
      writeSAXWasmChunks(parser, chunks);
    });
  });
});

describe('XML DOM (large source)', () => {
  test('tag-soup', () => {
    measure(() => {
      tagSoup.XMLDOMParser.parseDocument(largeXmlSource);
    });
  });

  test('htmlparser2', () => {
    let parser: htmlparser2.Parser;

    beforeBatch(() => {
      parser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null), {
        xmlMode: true,
      });
    });

    measure(() => {
      parser.reset();
      parser.end(largeXmlSource);
    });
  });

  test('fast-xml-parser', () => {
    const parser = new fastXmlParser.XMLParser({ ignoreAttributes: false });

    measure(() => {
      parser.parse(largeXmlSource);
    });
  });
});

describe('XML DOM (small source)', () => {
  test('tag-soup', () => {
    measure(() => {
      tagSoup.XMLDOMParser.parseDocument(smallXmlSource);
    });
  });

  test('htmlparser2', () => {
    let parser: htmlparser2.Parser;

    beforeBatch(() => {
      parser = new htmlparser2.Parser(new htmlparser2.DomHandler(() => null), {
        xmlMode: true,
      });
    });

    measure(() => {
      parser.reset();
      parser.end(smallXmlSource);
    });
  });

  test('fast-xml-parser', () => {
    const parser = new fastXmlParser.XMLParser({ ignoreAttributes: false });

    measure(() => {
      parser.parse(smallXmlSource);
    });
  });
});

describe('XML serializer', () => {
  test('tag-soup', () => {
    const document = tagSoup.XMLDOMParser.parseDocument(smallXmlSource);

    measure(() => {
      tagSoup.toXML(document);
    });
  });

  test('fast-xml-parser', () => {
    const builder = new fastXmlParser.XMLBuilder({ ignoreAttributes: false });
    const document = new fastXmlParser.XMLParser({ ignoreAttributes: false }).parse(smallXmlSource);

    measure(() => {
      builder.build(document);
    });
  });
});

// Streams emit chunks of bytes
function splitIntoByteChunks(source: string): Uint8Array[] {
  const bytes = new TextEncoder().encode(source);
  const byteChunks = [];

  for (let i = 0; i < bytes.length; i += chunkSize) {
    byteChunks.push(bytes.subarray(i, i + chunkSize));
  }
  return byteChunks;
}

// Chunks of bytes are decoded before they are written to parsers that read strings, like streams with an encoding do
function splitIntoTextChunks(source: string): string[] {
  const textDecoder = new TextDecoder();
  const textChunks = [];

  for (const byteChunk of splitIntoByteChunks(source)) {
    textChunks.push(textDecoder.decode(byteChunk, { stream: true }));
  }
  return textChunks;
}

async function createSAXWasmParser(events: number): Promise<saxWasm.SAXParser> {
  const parser = new saxWasm.SAXParser(events);

  await parser.prepareWasm(fs.readFileSync(new URL(import.meta.resolve('sax-wasm/lib/sax-wasm.wasm'))));

  return parser;
}

// Receives the same events as SAX handlers of other parsers: start tags with attributes, end tags and text
async function createSAXWasmParserWithHandlers(): Promise<saxWasm.SAXParser> {
  const parser = await createSAXWasmParser(
    saxWasm.SaxEventType.OpenTag | saxWasm.SaxEventType.CloseTag | saxWasm.SaxEventType.Text
  );

  // sax-wasm decodes names and values when they are read, while other parsers pass them to handlers as strings
  parser.eventHandler = (event, detail) => {
    if (event === saxWasm.SaxEventType.OpenTag) {
      const tag = detail as saxWasm.Tag;

      tag.name;

      for (const attribute of tag.attributes) {
        attribute.name.value;
        attribute.value.value;
      }
      return;
    }

    if (event === saxWasm.SaxEventType.CloseTag) {
      (detail as saxWasm.Tag).name;
      return;
    }

    (detail as saxWasm.Text).value;
  };

  return parser;
}

// sax-wasm copies each chunk into its memory, which can't fit large sources, so sources are always written in chunks
function writeSAXWasmChunks(parser: saxWasm.SAXParser, chunks: Uint8Array[]): void {
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.end();
}

function createTokenizerCallbacks(): htmlparser2.TokenizerCallbacks {
  return {
    onattribdata: noop,
    onattribentity: noop,
    onattribend: noop,
    onattribname: noop,
    oncdata: noop,
    onclosetag: noop,
    oncomment: noop,
    ondeclaration: noop,
    onend: noop,
    onopentagend: noop,
    onopentagname: noop,
    onprocessinginstruction: noop,
    onselfclosingtag: noop,
    ontext: noop,
    ontextentity: noop,
  };
}
