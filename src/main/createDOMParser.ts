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
import type { TagParsingConfig } from './resolveTokenizerOptions.ts';
import { ClosureWriter, createTokenizerWriter, type TokenHandler } from './tokenizeMarkup.ts';
import { type ParserOptions, type ParserWriter } from './types.ts';
import { keepHiddenClasses } from './utils.ts';

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
  isRawText = false;
  pendingAttributeName = '';
  piTarget = '';

  constructor(config: ParserConfig) {
    this.decodeText = config.decodeText;
    this.decodeAttribute = config.decodeAttribute;
    this.rootNode = this.parentNode = config.isFragment ? new DocumentFragment() : new Document();
  }

  onText(startIndex: number, endIndex: number, input: string): void {
    const text = input.substring(startIndex, endIndex);

    // Called through a local, so the decoder gets `this` undefined
    const decodeText = this.decodeText;

    this.parentNode.appendChild(new Text(this.isRawText ? text : decodeText(text)));
  }

  onStartTagName(startIndex: number, endIndex: number, input: string, tagConfig: TagParsingConfig | undefined): void {
    const element = new Element(input.substring(startIndex, endIndex));

    this.isRawText = tagConfig !== undefined && tagConfig.isRawText;

    this.parentNode.appendChild(element);
    this.parentNode = element;
  }

  onStartTagClosing(): void {}

  onStartTagSelfClosing(): void {
    this.isRawText = false;
    this.parentNode = this.parentNode.parentNode!;
  }

  onEndTagName(): void {
    this.isRawText = false;
    this.parentNode = this.parentNode.parentNode!;
  }

  onAttributeName(startIndex: number, endIndex: number, input: string): void {
    this.pendingAttributeName = input.substring(startIndex, endIndex);
  }

  onAttributeValue(startIndex: number, endIndex: number, input: string): void {
    // Called through a local, so the decoder gets `this` undefined
    const decodeAttribute = this.decodeAttribute;

    (this.parentNode as Element).setAttribute(
      this.pendingAttributeName,
      decodeAttribute(input.substring(startIndex, endIndex))
    );
  }

  onComment(startIndex: number, endIndex: number, input: string): void {
    this.parentNode.appendChild(new Comment(input.substring(startIndex, endIndex)));
  }

  onProcessingInstructionTarget(startIndex: number, endIndex: number, input: string): void {
    this.piTarget = input.substring(startIndex, endIndex);
  }

  onProcessingInstructionData(startIndex: number, endIndex: number, input: string): void {
    this.parentNode.appendChild(new ProcessingInstruction(this.piTarget, input.substring(startIndex, endIndex)));
  }

  onCDATASection(startIndex: number, endIndex: number, input: string): void {
    this.parentNode.appendChild(new CDATASection(input.substring(startIndex, endIndex)));
  }

  onDoctypeName(startIndex: number, endIndex: number, input: string): void {
    this.parentNode.appendChild(new DocumentType(input.substring(startIndex, endIndex)));
  }
}

keepHiddenClasses(
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
