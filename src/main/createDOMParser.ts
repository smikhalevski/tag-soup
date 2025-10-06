import { resolveTokenizerOptions } from './createTokenizer.js';
import { TokenCallback, tokenizeMarkup } from './tokenizeMarkup.js';
import {
  CDATASection,
  Comment,
  Document,
  DocumentFragment,
  DocumentType,
  Element,
  ParentNode,
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
  parseDocumentFragment(text: string): DocumentFragment;
}

/**
 * Parses text as a DOM.
 *
 * @example
 * import { createDOMParser, htmlTokenizerOptions } from 'tag-soup';
 *
 * const parser = createDOMParser(htmlTokenizerOptions);
 *
 * parser.parseDocumentFragment('Hello, <b>Bob</b>!');
 *
 * @param options Parser options.
 * @group DOM
 */
export function createDOMParser(options: ParserOptions = {}): DOMParser {
  const { decodeText } = options;

  const documentOptions: ResolvedParserOptions = { ...resolveTokenizerOptions(options), decodeText };

  const documentFragmentOptions: ResolvedParserOptions = { ...documentOptions, isDocumentFragment: true };

  return {
    parseDocument(text) {
      return parseDOM(text, documentOptions) as Document;
    },

    parseDocumentFragment(text) {
      return parseDOM(text, documentFragmentOptions) as DocumentFragment;
    },
  };
}

/**
 * Parses text as a document.
 *
 * @example
 * parseDOM('Hello, <b>Bob</b>!', createTokenizer(htmlTokenizerOptions());
 *
 * @param text The text to parse.
 * @param options Parser options.
 * @returns The document node.
 */
export function parseDOM(text: string, options: ResolvedParserOptions = {}): ParentNode {
  const { isDocumentFragment, decodeText } = options;

  const rootNode: ParentNode = isDocumentFragment ? new DocumentFragment() : new Document();

  let parentNode = rootNode;
  let attributeName: string;
  let processingInstructionTarget: string;
  let data: string;

  const tokenCallback: TokenCallback = (token, startIndex, endIndex) => {
    switch (token) {
      case 'TEXT':
        data = text.substring(startIndex, endIndex);

        parentNode.appendChild(new Text(decodeText !== undefined ? decodeText(data) : data));
        break;

      case 'START_TAG_NAME':
        parentNode.appendChild((parentNode = new Element(text.substring(startIndex, endIndex))));
        break;

      case 'START_TAG_CLOSING':
        break;

      case 'START_TAG_SELF_CLOSING':
      case 'END_TAG_NAME':
        parentNode = parentNode.parentNode!;
        break;

      case 'ATTRIBUTE_NAME':
        attributeName = text.substring(startIndex, endIndex);
        break;

      case 'ATTRIBUTE_VALUE':
        data = text.substring(startIndex, endIndex);

        (parentNode as Element).setAttribute(attributeName, decodeText !== undefined ? decodeText(data) : data);
        break;

      case 'CDATA_SECTION':
        parentNode.appendChild(new CDATASection(text.substring(startIndex, endIndex)));
        break;

      case 'COMMENT':
        parentNode.appendChild(new Comment(text.substring(startIndex, endIndex)));
        break;

      case 'DOCTYPE_NAME':
        parentNode.appendChild(new DocumentType(text.substring(startIndex, endIndex)));
        break;

      case 'PROCESSING_INSTRUCTION_TARGET':
        processingInstructionTarget = text.substring(startIndex, endIndex);
        break;

      case 'PROCESSING_INSTRUCTION_DATA':
        parentNode.appendChild(
          new ProcessingInstruction(processingInstructionTarget, text.substring(startIndex, endIndex))
        );
        break;
    }
  };

  tokenizeMarkup(text, tokenCallback, options);

  return rootNode;
}
