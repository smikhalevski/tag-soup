import { resolveTokenizerOptions } from './createTokenizer.js';
import { ParserError, TokenCallback, tokenizeMarkup } from './tokenizeMarkup.js';
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
import { ParserOptions, ResolvedParserOptions } from './types.js';

/**
 * Parses text as a DOM.
 *
 * @group DOM
 */
export interface DOMParser {
  /**
   * Parses text as a document.
   *
   * @param text The text to parse.
   * @returns The document node.
   */
  parseDocument(text: string): Document;

  /**
   * Parses text as a document fragment.
   *
   * @param text The text to parse.
   * @returns The document fragment node.
   */
  parseFragment(text: string): DocumentFragment;
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
    parseDocument(text) {
      return parseDOM(text, documentOptions) as Document;
    },

    parseFragment(text) {
      return parseDOM(text, fragmentOptions) as DocumentFragment;
    },
  };
}

/**
 * Parses text as a DOM.
 *
 * @param text The text to parse.
 * @param options Parser options.
 * @returns The document or document fragment node.
 */
export function parseDOM(text: string, options: ResolvedParserOptions = {}): Document | DocumentFragment {
  const { isStrict, isFragment, decodeText = identity } = options;

  const root = isFragment ? new DocumentFragment() : new Document();

  let parent = root;
  let attributeName: string;
  let piTarget: string;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex) => {
    switch (token) {
      case 'TEXT':
        parent.appendChild(new Text(decodeText(text.substring(startIndex, endIndex))));
        break;

      case 'START_TAG_NAME':
        parent.appendChild((parent = new Element(text.substring(startIndex, endIndex))));
        break;

      case 'START_TAG_CLOSING':
        break;

      case 'START_TAG_SELF_CLOSING':
      case 'END_TAG_NAME':
        parent = parent.parentNode!;
        break;

      case 'ATTRIBUTE_NAME':
        attributeName = text.substring(startIndex, endIndex);
        break;

      case 'ATTRIBUTE_VALUE':
        (parent as Element).setAttribute(attributeName, decodeText(text.substring(startIndex, endIndex)));
        break;

      case 'CDATA_SECTION':
        parent.appendChild(new CDATASection(text.substring(startIndex, endIndex)));
        break;

      case 'COMMENT':
        parent.appendChild(new Comment(decodeText(text.substring(startIndex, endIndex))));
        break;

      case 'DOCTYPE_NAME':
        parent.appendChild(new DocumentType(text.substring(startIndex, endIndex)));
        break;

      case 'PROCESSING_INSTRUCTION_TARGET':
        piTarget = text.substring(startIndex, endIndex);
        break;

      case 'PROCESSING_INSTRUCTION_DATA':
        parent.appendChild(new ProcessingInstruction(piTarget, text.substring(startIndex, endIndex)));
        break;
    }
  };

  tokenizeMarkup(text, tokenCallback, options);

  if (isStrict && parent !== root) {
    throw new ParserError('Expected an end tag.', text, text.length);
  }

  return root;
}

function identity(value: string): string {
  return value;
}
