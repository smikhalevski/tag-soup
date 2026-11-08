import {
  CDATASection,
  Comment,
  Document,
  DocumentFragment,
  DocumentType,
  Element,
  ProcessingInstruction,
  Text,
} from 'flyweight-dom';
import { type ResolvedParserOptions, resolveParserOptions } from './resolveParserOptions.ts';
import { createTokenizerState, createTokenizerWriter } from './tokenizeMarkup.ts';
import { type ParserOptions, type ParserWriter, type TokenCallback } from './types.ts';

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
  const documentOptions: ResolvedParserOptions = resolveParserOptions(options);

  const fragmentOptions: ResolvedParserOptions = { ...documentOptions, isFragment: true };

  return {
    parseDocument(input) {
      return createDOMParserWriter(documentOptions).end(input) as Document;
    },

    parseFragment(input) {
      return createDOMParserWriter(fragmentOptions).end(input) as DocumentFragment;
    },

    createDocumentWriter() {
      return createDOMParserWriter(documentOptions) as ParserWriter<Document>;
    },

    createFragmentWriter() {
      return createDOMParserWriter(fragmentOptions) as ParserWriter<DocumentFragment>;
    },
  };
}

/**
 * Creates a writer that parses chunks of text as a DOM.
 *
 * @param options Parser options.
 * @returns The writer that returns the document node, or the document fragment node if
 * {@link ResolvedParserOptions.isFragment} is `true`.
 * @see {@link createTokenizerWriter}
 * @internal
 */
export function createDOMParserWriter(options: ResolvedParserOptions): ParserWriter<Document | DocumentFragment> {
  const { isFragment, decodeText, decodeAttribute } = options;

  const tokenizerState = createTokenizerState(options.initialContext);

  const rootNode = isFragment ? new DocumentFragment() : new Document();

  let parentNode = rootNode;
  let isRawText = false;
  let attributeName: string;
  let piTarget: string;

  const tokenCallback: TokenCallback = (tokenKind, startIndex, endIndex, input) => {
    switch (tokenKind) {
      case 'text': {
        const text = input.substring(startIndex, endIndex);

        parentNode.appendChild(new Text(isRawText ? text : decodeText(text)));
        break;
      }

      case 'start_tag_name': {
        const tagOptions = tokenizerState.tagOptions;

        isRawText = tagOptions !== undefined && tagOptions.isRawText;

        parentNode.appendChild((parentNode = new Element(input.substring(startIndex, endIndex))));
        break;
      }

      case 'start_tag_closing':
        break;

      case 'end_tag_name':
      case 'start_tag_self_closing':
        isRawText = false;
        parentNode = parentNode.parentNode!;
        break;

      case 'attribute_name':
        attributeName = input.substring(startIndex, endIndex);
        break;

      case 'attribute_value':
        (parentNode as Element).setAttribute(attributeName, decodeAttribute(input.substring(startIndex, endIndex)));
        break;

      case 'cdata_section':
        parentNode.appendChild(new CDATASection(input.substring(startIndex, endIndex)));
        break;

      case 'comment':
        parentNode.appendChild(new Comment(input.substring(startIndex, endIndex)));
        break;

      case 'doctype_name':
        parentNode.appendChild(new DocumentType(input.substring(startIndex, endIndex)));
        break;

      case 'processing_instruction_target':
        piTarget = input.substring(startIndex, endIndex);
        break;

      case 'processing_instruction_data':
        parentNode.appendChild(new ProcessingInstruction(piTarget, input.substring(startIndex, endIndex)));
        break;
    }
  };

  const tokenizerWriter = createTokenizerWriter(tokenCallback, options, tokenizerState);

  return {
    write(chunk) {
      tokenizerWriter.write(chunk);
    },

    end(chunk) {
      tokenizerWriter.end(chunk);
      return rootNode;
    },
  };
}
