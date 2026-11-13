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
import { type ParserOptions, type ParserWriter, type TokenHandler, type TokenizerWriter } from './types.ts';
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
  const config = resolveParserOptions(options);

  const { tokenizer } = config;

  return {
    parseDocument(input) {
      const tokenHandler = new DOMTokenHandler(new Document(), config);

      tokenizer.tokenizeDocument(input, tokenHandler);

      return tokenHandler.rootNode;
    },

    parseFragment(input) {
      const tokenHandler = new DOMTokenHandler(new DocumentFragment(), config);

      tokenizer.tokenizeFragment(input, tokenHandler);

      return tokenHandler.rootNode;
    },

    createDocumentWriter() {
      const tokenHandler = new DOMTokenHandler(new Document(), config);

      return createDOMParserWriter(tokenHandler, tokenizer.createDocumentWriter(tokenHandler));
    },

    createFragmentWriter() {
      const tokenHandler = new DOMTokenHandler(new DocumentFragment(), config);

      return createDOMParserWriter(tokenHandler, tokenizer.createFragmentWriter(tokenHandler));
    },
  };
}

/**
 * Creates a writer that passes chunks of text to a tokenizer writer, and returns the root node that the token handler
 * has built.
 *
 * @param tokenHandler The handler that the tokenizer writer passes tokens to.
 * @param tokenizerWriter The writer that reads tokens from chunks.
 */
function createDOMParserWriter<TRootNode extends Document | DocumentFragment>(
  tokenHandler: DOMTokenHandler<TRootNode>,
  tokenizerWriter: TokenizerWriter
): ParserWriter<TRootNode> {
  return {
    write(chunk) {
      tokenizerWriter.write(chunk);
    },

    end(chunk) {
      tokenizerWriter.end(chunk);
      return tokenHandler.rootNode;
    },
  };
}

/**
 * Builds a DOM from tokens.
 */
class DOMTokenHandler<TRootNode extends Document | DocumentFragment> implements TokenHandler {
  renameTag: (name: string) => string;
  renameAttribute: (name: string) => string;
  decodeText: (text: string) => string;
  decodeAttribute: (value: string) => string;
  rootNode: TRootNode;
  parentNode: ParentNode;

  constructor(rootNode: TRootNode, config: ParserConfig) {
    this.renameTag = config.renameTag;
    this.renameAttribute = config.renameAttribute;
    this.decodeText = config.decodeText;
    this.decodeAttribute = config.decodeAttribute;
    this.parentNode = rootNode;
    this.rootNode = rootNode;
  }

  onText(input: string, startIndex: number, endIndex: number, isRawText: boolean): void {
    const text = input.substring(startIndex, endIndex);

    this.parentNode.appendChild(new Text(isRawText ? text : (0, this.decodeText)(text)));
  }

  onStartTagName(input: string, startIndex: number, endIndex: number): void {
    const element = new Element((0, this.renameTag)(input.substring(startIndex, endIndex)));

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
    input: string,
    nameStartIndex: number,
    nameEndIndex: number,
    valueStartIndex: number,
    valueEndIndex: number
  ): void {
    (this.parentNode as Element).setAttribute(
      (0, this.renameAttribute)(input.substring(nameStartIndex, nameEndIndex)),
      (0, this.decodeAttribute)(input.substring(valueStartIndex, valueEndIndex))
    );
  }

  onComment(input: string, startIndex: number, endIndex: number): void {
    this.parentNode.appendChild(new Comment(input.substring(startIndex, endIndex)));
  }

  onProcessingInstruction(
    input: string,
    targetStartIndex: number,
    targetEndIndex: number,
    dataStartIndex: number,
    dataEndIndex: number
  ): void {
    this.parentNode.appendChild(
      new ProcessingInstruction(
        input.substring(targetStartIndex, targetEndIndex),
        input.substring(dataStartIndex, dataEndIndex)
      )
    );
  }

  onCDATASection(input: string, startIndex: number, endIndex: number): void {
    this.parentNode.appendChild(new CDATASection(input.substring(startIndex, endIndex)));
  }

  onDoctypeName(input: string, startIndex: number, endIndex: number): void {
    this.parentNode.appendChild(new DocumentType(input.substring(startIndex, endIndex)));
  }
}

retainHiddenClasses(
  new DOMTokenHandler(new Document(), resolveParserOptions({})),
  new DocumentFragment(),
  new Element(''),
  new Text(''),
  new Comment(''),
  new CDATASection(''),
  new ProcessingInstruction('', ''),
  new DocumentType('')
);
