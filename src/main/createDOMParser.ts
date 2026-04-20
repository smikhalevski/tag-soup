import { resolveTokenizerOptions } from './createTokenizer.js';
import { ParserError, type TokenCallback, tokenizeMarkup } from './tokenizeMarkup.js';
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
import type { ParserOptions, ResolvedParserOptions } from './types.js';

/**
 * Parses text as a DOM.
 *
 * @group DOM
 */
export interface DOMParser {
  /**
   * Parses text as a document.
   *
   * @param input The text to parse.
   * @returns The document node.
   */
  parseDocument(input: string): Document;

  /**
   * Parses text as a document fragment.
   *
   * @param input The text to parse.
   * @returns The document fragment node.
   */
  parseFragment(input: string): DocumentFragment;
}

/**
 * Parses text as a DOM.
 *
 * @example
 * import { createDOMParser, htmlTokenizerOptions } from 'tag-soup';
 *
 * const parser = createDOMParser(htmlTokenizerOptions);
 *
 * parser.parseFragment('Hello, <b>Bob</b>!');
 * // ⮕ DocumentFragment
 *
 * @param options Parser options.
 * @group DOM
 */
export function createDOMParser(options: ParserOptions = {}): DOMParser {
  const { decodeText } = options;

  const documentOptions: ResolvedParserOptions = { ...resolveTokenizerOptions(options), decodeText };

  const fragmentOptions: ResolvedParserOptions = { ...documentOptions, isFragment: true };

  return {
    parseDocument(input) {
      return parseDOM(input, documentOptions) as Document;
    },

    parseFragment(input) {
      return parseDOM(input, fragmentOptions) as DocumentFragment;
    },
  };
}

/**
 * Parses text as a DOM.
 *
 * @param input The text to parse.
 * @param options Parser options.
 * @returns The document or document fragment node.
 */
export function parseDOM(input: string, options: ResolvedParserOptions = {}): Document | DocumentFragment {
  const { isStrict, isFragment, decodeText = identity } = options;

  const root = isFragment ? new DocumentFragment() : new Document();

  let parent = root;
  let attributeName: string;
  let piTarget: string;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex) => {
    switch (token) {
      case 'TEXT':
        parent.appendChild(new Text(decodeText(input.substring(startIndex, endIndex))));
        break;

      case 'START_TAG_NAME':
        parent.appendChild((parent = new Element(input.substring(startIndex, endIndex))));
        break;

      case 'START_TAG_CLOSING':
        break;

      case 'START_TAG_SELF_CLOSING':
      case 'END_TAG_NAME':
        parent = parent.parentNode!;
        break;

      case 'ATTRIBUTE_NAME':
        attributeName = input.substring(startIndex, endIndex);
        break;

      case 'ATTRIBUTE_VALUE':
        (parent as Element).setAttribute(attributeName, decodeText(input.substring(startIndex, endIndex)));
        break;

      case 'CDATA_SECTION':
        parent.appendChild(new CDATASection(input.substring(startIndex, endIndex)));
        break;

      case 'COMMENT':
        parent.appendChild(new Comment(decodeText(input.substring(startIndex, endIndex))));
        break;

      case 'DOCTYPE_NAME':
        parent.appendChild(new DocumentType(input.substring(startIndex, endIndex)));
        break;

      case 'PROCESSING_INSTRUCTION_TARGET':
        piTarget = input.substring(startIndex, endIndex);
        break;

      case 'PROCESSING_INSTRUCTION_DATA':
        parent.appendChild(new ProcessingInstruction(piTarget, input.substring(startIndex, endIndex)));
        break;
    }
  };

  tokenizeMarkup(input, tokenCallback, options);

  if (isStrict && parent !== root) {
    throw new ParserError('Expected an end tag.', input, input.length);
  }

  return root;
}

function identity(value: string): string {
  return value;
}
