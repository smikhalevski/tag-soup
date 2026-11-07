import {
  CDATASection,
  type ChildNode,
  Comment,
  Document,
  DocumentFragment,
  DocumentType,
  Element,
  type ParentNode,
  ProcessingInstruction,
  Text,
} from 'flyweight-dom';
import { type TokenCallback, tokenizeMarkup, type TokenizerState } from './tokenizeMarkup.ts';
import { normalizeNewlines, type ParserOptions, type ResolvedParserOptions, resolveParserOptions } from './types.ts';

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
  const documentOptions: ResolvedParserOptions = resolveParserOptions(options);

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
export function parseDOM(input: string, options: ResolvedParserOptions = { context: {} }): Document | DocumentFragment {
  const {
    isFragment,
    decodeText = identity,
    decodeAttribute = identity,
    areNewlinesNormalized = false,
    areNullCharactersReplaced = false,
  } = options;

  if (areNewlinesNormalized) {
    input = normalizeNewlines(input);
  }

  const hasNullCharacters = areNullCharactersReplaced && input.indexOf('\0') !== -1;

  // Strings are read from the input with NUL chars replaced. U+FFFD has the same length as NUL, so tokens point to the
  // same chars in both inputs.
  const replacedInput = hasNullCharacters ? input.replace(/\0/g, '\uFFFD') : input;

  // The tokenizer looks up each start tag, so it isn't looked up again here
  const state: TokenizerState = { tagHashCode: 0, tagOptions: undefined, context: options.context };

  const root = isFragment ? new DocumentFragment() : new Document();

  let parent = root;
  let isRawText = false;
  let isEscapableRawText = false;
  let attributeName: string;
  let piTarget: string;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex) => {
    switch (token) {
      case 'TEXT': {
        // NUL chars are removed from text outside of raw text and foreign tags, after entities are decoded, so
        // "&\0amp;" isn't decoded
        if (hasNullCharacters && !isRawText && !isEscapableRawText && state.context === options.context) {
          const text = decodeText(input.substring(startIndex, endIndex)).replace(/\0/g, '');

          if (text !== '') {
            uncheckedAppendChild(parent, new Text(text));
          }
          break;
        }

        const text = replacedInput.substring(startIndex, endIndex);

        uncheckedAppendChild(parent, new Text(isRawText ? text : decodeText(text)));
        break;
      }

      case 'START_TAG_NAME':
        // Text inside raw text tags isn't decoded
        isRawText = state.tagOptions !== undefined && state.tagOptions.isRawText;

        // NUL chars aren't removed from text inside escapable raw text tags
        isEscapableRawText = state.tagOptions !== undefined && state.tagOptions.isEscapableRawText;

        uncheckedAppendChild(parent, (parent = new Element(replacedInput.substring(startIndex, endIndex))));
        break;

      case 'START_TAG_CLOSING':
        break;

      case 'START_TAG_SELF_CLOSING':
      case 'END_TAG_NAME':
        isRawText = false;
        isEscapableRawText = false;
        parent = parent.parentNode!;
        break;

      case 'ATTRIBUTE_NAME':
        attributeName = replacedInput.substring(startIndex, endIndex);
        break;

      case 'ATTRIBUTE_VALUE':
        (parent as Element).setAttribute(attributeName, decodeAttribute(replacedInput.substring(startIndex, endIndex)));
        break;

      case 'CDATA_SECTION':
        uncheckedAppendChild(parent, new CDATASection(replacedInput.substring(startIndex, endIndex)));
        break;

      case 'COMMENT':
        uncheckedAppendChild(parent, new Comment(replacedInput.substring(startIndex, endIndex)));
        break;

      case 'DOCTYPE_NAME':
        uncheckedAppendChild(parent, new DocumentType(replacedInput.substring(startIndex, endIndex)));
        break;

      case 'PROCESSING_INSTRUCTION_TARGET':
        piTarget = replacedInput.substring(startIndex, endIndex);
        break;

      case 'PROCESSING_INSTRUCTION_DATA':
        uncheckedAppendChild(
          parent,
          new ProcessingInstruction(piTarget, replacedInput.substring(startIndex, endIndex))
        );
        break;
    }
  };

  tokenizeMarkup(input, tokenCallback, options, state);

  return root;
}

function identity(value: string): string {
  return value;
}

/**
 * Appends a node to the end of the parent's children. Unlike {@link ParentNode.appendChild}, it doesn't check that the
 * node can be inserted, and doesn't remove it from its current parent, so it's faster. The parser only appends new
 * nodes that have no parent and aren't document fragments.
 */
function uncheckedAppendChild(parent: ParentNode, node: ChildNode): void {
  const { lastChild } = parent;

  parent['_notifyChildrenChanged']();

  node.parentNode = parent;
  parent.lastChild = node;

  if (lastChild !== null) {
    lastChild.nextSibling = node;
    node.previousSibling = lastChild;
  } else {
    parent.firstChild = node;
  }
}
