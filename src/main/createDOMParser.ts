import {
  CDATASection,
  Comment,
  Document,
  DocumentFragment,
  DocumentType,
  Element,
  type ParentNode,
  ProcessingInstruction,
  Text,
} from 'flyweight-dom';
import { type ParserConfig, resolveParserOptions } from './resolveParserOptions.ts';
import { ClosureWriter, createTokenizerWriter } from './tokenizeMarkup.ts';
import { type ParserOptions, type ParserWriter, type TokenHandler } from './types.ts';
import { retainHiddenClasses } from './utils.ts';

/**
 * Parses text as a DOM.
 *
 * @see {@link createDOMParser}
 * @group DOM
 */
export interface DOMParser {
  /**
   * Parses text as a document.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @param input The text to parse.
   * @returns The document node.
   * @throws {@link MarkupSyntaxError} If input is malformed and parser options don't allow to recover.
   */
  parseDocument(input: string): Document;

  /**
   * Parses text as a document fragment.
   *
   * DOCTYPE isn't recognized.
   *
   * @param input The text to parse.
   * @returns The document fragment node.
   * @throws {@link MarkupSyntaxError} If input is malformed and parser options don't allow to recover.
   */
  parseFragment(input: string): DocumentFragment;

  /**
   * Creates a writer that parses a document written in chunks.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @example
   * const writer = HTMLDOMParser.createDocumentWriter();
   *
   * writer.write('<p>Hello, ');
   * writer.write('Bob!');
   *
   * writer.end();
   * // ⮕ Document
   *
   * @returns The new writer.
   */
  createDocumentWriter(): ParserWriter<Document>;

  /**
   * Creates a writer that parses a document fragment written in chunks.
   *
   * DOCTYPE isn't recognized.
   *
   * @returns The new writer.
   */
  createFragmentWriter(): ParserWriter<DocumentFragment>;
}

/**
 * Creates a parser that parses text as a DOM.
 *
 * @example
 * import { HTMLDOMParser } from 'tag-soup';
 *
 * HTMLDOMParser.parseFragment('Hello, <b>Bob</b>!');
 * // ⮕ DocumentFragment
 *
 * @param options Parser options.
 * @returns The new DOM parser.
 * @group DOM
 */
export function createDOMParser(options: ParserOptions = {}): DOMParser {
  const documentConfig: ParserConfig = resolveParserOptions(options);

  const fragmentConfig: ParserConfig = { ...documentConfig, isFragment: true };

  return {
    parseDocument(input) {
      return createDOMParserWriter(documentConfig).end(input) as Document;
    },

    parseFragment(input) {
      return createDOMParserWriter(fragmentConfig).end(input) as DocumentFragment;
    },

    createDocumentWriter() {
      return createDOMParserWriter(documentConfig) as ParserWriter<Document>;
    },

    createFragmentWriter() {
      return createDOMParserWriter(fragmentConfig) as ParserWriter<DocumentFragment>;
    },
  };
}

/**
 * Creates a writer that parses chunks of text into a document, or into a fragment if {@link ParserConfig.isFragment} is
 * `true`.
 *
 * @see {@link createTokenizerWriter}
 */
function createDOMParserWriter(config: ParserConfig): ParserWriter<Document | DocumentFragment> {
  const tokenHandler = new DOMTokenHandler(config);

  const tokenizerWriter = createTokenizerWriter(tokenHandler, config);

  return new ClosureWriter(
    chunk => {
      tokenizerWriter.write(chunk);
    },
    chunk => {
      tokenizerWriter.end(chunk);
      return tokenHandler.rootNode;
    }
  );
}

/**
 * Builds a DOM from tokens.
 */
class DOMTokenHandler implements TokenHandler {
  decodeText: (text: string) => string;
  decodeAttribute: (value: string) => string;
  rootNode: Document | DocumentFragment;
  parentNode: ParentNode;

  constructor(config: ParserConfig) {
    this.decodeText = config.decodeText;
    this.decodeAttribute = config.decodeAttribute;
    this.rootNode = this.parentNode = config.isFragment ? new DocumentFragment() : new Document();
  }

  onText(startIndex: number, endIndex: number, input: string, isRawText: boolean): void {
    const text = input.substring(startIndex, endIndex);

    this.parentNode.appendChild(new Text(isRawText ? text : (0, this.decodeText)(text)));
  }

  onStartTagName(startIndex: number, endIndex: number, input: string): void {
    const element = new Element(input.substring(startIndex, endIndex));

    this.parentNode.appendChild(element);
    this.parentNode = element;
  }

  onStartTagSelfClosing(): void {
    this.parentNode = this.parentNode.parentNode!;
  }

  onEndTagName(): void {
    this.parentNode = this.parentNode.parentNode!;
  }

  onAttribute(
    nameStartIndex: number,
    nameEndIndex: number,
    valueStartIndex: number,
    valueEndIndex: number,
    input: string
  ): void {
    (this.parentNode as Element).setAttribute(
      input.substring(nameStartIndex, nameEndIndex),
      (0, this.decodeAttribute)(input.substring(valueStartIndex, valueEndIndex))
    );
  }

  onComment(startIndex: number, endIndex: number, input: string): void {
    this.parentNode.appendChild(new Comment(input.substring(startIndex, endIndex)));
  }

  onProcessingInstruction(
    targetStartIndex: number,
    targetEndIndex: number,
    dataStartIndex: number,
    dataEndIndex: number,
    input: string
  ): void {
    this.parentNode.appendChild(
      new ProcessingInstruction(
        input.substring(targetStartIndex, targetEndIndex),
        input.substring(dataStartIndex, dataEndIndex)
      )
    );
  }

  onCDATASection(startIndex: number, endIndex: number, input: string): void {
    this.parentNode.appendChild(new CDATASection(input.substring(startIndex, endIndex)));
  }

  onDoctypeName(startIndex: number, endIndex: number, input: string): void {
    this.parentNode.appendChild(new DocumentType(input.substring(startIndex, endIndex)));
  }
}

retainHiddenClasses(
  new DOMTokenHandler(resolveParserOptions({})),
  new Document(),
  new DocumentFragment(),
  new Element(''),
  new Text(''),
  new Comment(''),
  new CDATASection(''),
  new ProcessingInstruction('', ''),
  new DocumentType('')
);
