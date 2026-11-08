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
import {
  createTokenizerState,
  createTokenizerWriter,
  type ParserWriter,
  type TokenCallback,
} from './tokenizeMarkup.ts';
import { type ParserOptions, type ResolvedParserOptions, resolveParserOptions } from './types.ts';

/**
 * Parses text as a DOM.
 *
 * @see {@link createDOMParser}
 * @group DOM
 */
export interface DOMParser {
  /**
   * Parses text as a document. Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text.
   *
   * @param input The text to parse.
   * @returns The document node.
   * @throws {@link ParserError} If input is malformed and parser options don't allow to recover.
   */
  parseDocument(input: string): Document;

  /**
   * Parses text as a document fragment. DOCTYPE isn't recognized.
   *
   * @param input The text to parse.
   * @returns The document fragment node.
   * @throws {@link ParserError} If input is malformed and parser options don't allow to recover.
   */
  parseFragment(input: string): DocumentFragment;

  /**
   * Creates a writer that parses a document written in chunks. Leading spaces are skipped, and DOCTYPE is recognized
   * before the first tag or text.
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
   * Creates a writer that parses a document fragment written in chunks. DOCTYPE isn't recognized.
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
      return parseDOM(input, documentOptions) as Document;
    },

    parseFragment(input) {
      return parseDOM(input, fragmentOptions) as DocumentFragment;
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
 * Parses text as a DOM.
 *
 * @param input The text to parse.
 * @param options Parser options.
 * @returns The document node, or the document fragment node if {@link ResolvedParserOptions.isFragment} is `true`.
 * @throws {@link ParserError} If input is malformed and options don't allow to recover.
 * @internal
 */
export function parseDOM(
  input: string,
  options: ResolvedParserOptions = { initialContext: {} }
): Document | DocumentFragment {
  return createDOMParserWriter(options).end(input);
}

/**
 * Creates a writer that parses chunks of text as a DOM.
 *
 * @param options Parser options.
 * @returns The writer that returns the document node, or the document fragment node if
 *   {@link ResolvedParserOptions.isFragment} is `true`.
 * @see {@link createTokenizerWriter}
 * @internal
 */
export function createDOMParserWriter(options: ResolvedParserOptions): ParserWriter<Document | DocumentFragment> {
  const { isFragment, decodeText = identity, decodeAttribute = identity } = options;

  // The tokenizer looks up each start tag, so it isn't looked up again here
  const state = createTokenizerState(options.initialContext);

  const root = isFragment ? new DocumentFragment() : new Document();

  let parent = root;
  let isRawText = false;
  let attributeName: string;
  let piTarget: string;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex, input) => {
    switch (token) {
      case 'text': {
        const text = input.substring(startIndex, endIndex);

        parent.appendChild(new Text(isRawText ? text : decodeText(text)));
        break;
      }

      case 'start_tag_name': {
        const tagOptions = state.tagOptions;

        // Text inside raw text tags isn't decoded
        isRawText = tagOptions !== undefined && tagOptions.isRawText;

        parent.appendChild((parent = new Element(input.substring(startIndex, endIndex))));
        break;
      }

      case 'start_tag_closing':
        break;

      case 'end_tag_name':
      case 'start_tag_self_closing':
        isRawText = false;
        parent = parent.parentNode!;
        break;

      case 'attribute_name':
        attributeName = input.substring(startIndex, endIndex);
        break;

      case 'attribute_value':
        (parent as Element).setAttribute(attributeName, decodeAttribute(input.substring(startIndex, endIndex)));
        break;

      case 'cdata_section':
        parent.appendChild(new CDATASection(input.substring(startIndex, endIndex)));
        break;

      case 'comment':
        parent.appendChild(new Comment(input.substring(startIndex, endIndex)));
        break;

      case 'doctype_name':
        parent.appendChild(new DocumentType(input.substring(startIndex, endIndex)));
        break;

      case 'processing_instruction_target':
        piTarget = input.substring(startIndex, endIndex);
        break;

      case 'processing_instruction_data':
        parent.appendChild(new ProcessingInstruction(piTarget, input.substring(startIndex, endIndex)));
        break;
    }
  };

  const tokenizerWriter = createTokenizerWriter(tokenCallback, options, state);

  return {
    write(chunk) {
      tokenizerWriter.write(chunk);
    },

    end(chunk) {
      tokenizerWriter.end(chunk);
      return root;
    },
  };
}

function identity(value: string): string {
  return value;
}
