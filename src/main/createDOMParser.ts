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
import { resolveTokenizerOptions } from './createTokenizer.ts';
import { type TokenCallback, tokenizeMarkup } from './tokenizeMarkup.ts';
import type { ParserOptions, ResolvedParserOptions } from './types.ts';

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
  const { decodeText, decodeAttribute } = options;

  const documentOptions: ResolvedParserOptions = {
    ...resolveTokenizerOptions(options),
    decodeText,
    decodeAttribute,
  };

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
 * @returns The document node, or the document fragment node if {@link ResolvedParserOptions.isFragment} is `true`.
 * @throws {@link ParserError} If input is malformed and options don't allow to recover.
 * @internal
 */
export function parseDOM(input: string, options: ResolvedParserOptions = {}): Document | DocumentFragment {
  const { rawTextTagSet, isFragment, decodeText = identity, decodeAttribute = identity } = options;

  // Text inside raw text tags isn't decoded
  const undecodedTextTagSet = options.decodeText !== undefined ? rawTextTagSet : undefined;

  // The tokenizer sets the hash code of each start tag name, so it isn't hashed again here
  const state = { tagHashCode: 0 };

  const root = isFragment ? new DocumentFragment() : new Document();

  let parent = root;
  let isRawText = false;
  let attributeName: string;
  let piTarget: string;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex) => {
    switch (token) {
      case 'TEXT': {
        const text = input.substring(startIndex, endIndex);

        parent.appendChild(new Text(isRawText ? text : decodeText(text)));
        break;
      }

      case 'START_TAG_NAME':
        if (undecodedTextTagSet !== undefined) {
          isRawText = undecodedTextTagSet.has(state.tagHashCode);
        }

        parent.appendChild((parent = new Element(input.substring(startIndex, endIndex))));
        break;

      case 'START_TAG_CLOSING':
        break;

      case 'START_TAG_SELF_CLOSING':
      case 'END_TAG_NAME':
        isRawText = false;
        parent = parent.parentNode!;
        break;

      case 'ATTRIBUTE_NAME':
        attributeName = input.substring(startIndex, endIndex);
        break;

      case 'ATTRIBUTE_VALUE':
        (parent as Element).setAttribute(attributeName, decodeAttribute(input.substring(startIndex, endIndex)));
        break;

      case 'CDATA_SECTION':
        parent.appendChild(new CDATASection(input.substring(startIndex, endIndex)));
        break;

      case 'COMMENT':
        parent.appendChild(new Comment(input.substring(startIndex, endIndex)));
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

  tokenizeMarkup(input, tokenCallback, options, state);

  return root;
}

function identity(value: string): string {
  return value;
}
