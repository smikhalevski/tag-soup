import {TokenizerState} from 'tokenizer-dsl';

export const enum TokenStage {
  DOCUMENT,
  START_TAG_OPENING,
  ATTRIBUTE_NAME,
  ATTRIBUTE_EQ,
  END_TAG_OPENING,
  CDATA_TAG,
}

export const enum TokenType {
  START_TAG_OPENING = 'START_TAG_OPENING',
  START_TAG_CLOSING = 'START_TAG_CLOSING',
  ATTRIBUTE_NAME = 'ATTRIBUTE_NAME',
  ATTRIBUTE_VALUE = 'ATTRIBUTE_VALUE',
  ATTRIBUTE_UNQUOTED_VALUE = 'ATTRIBUTE_UNQUOTED_VALUE',
  END_TAG_OPENING = 'END_TAG_OPENING',
  END_TAG_CLOSING = 'END_TAG_CLOSING',
  IMPLICIT_END_TAG = 'IMPLICIT_END_TAG',
  IMPLICIT_START_TAG = 'IMPLICIT_START_TAG',
  COMMENT = 'COMMENT',
  PROCESSING_INSTRUCTION = 'PROCESSING_INSTRUCTION',
  CDATA_SECTION = 'CDATA_SECTION',
  DOCTYPE = 'DOCTYPE',
  TEXT = 'TEXT',
  DTD = 'DTD',
}

export interface LexerState extends TokenizerState<TokenStage> {

  /**
   * The list of tag name hash codes.
   */
  stack: number[];

  /**
   * The actual stack length.
   */
  cursor: number;

  /**
   * The hash code of the current tag name, or 0 if not in a tag context.
   */
  activeTag: number;
}

export type LexerHandler = (type: TokenType, chunk: string, offset: number, length: number, state: LexerState) => void;

export interface LexerContext {

  state: LexerState;

  handler: LexerHandler;

  selfClosingTagsEnabled: boolean;

  // Set hash codes of void tags: img, br, etc.
  voidTags: Set<number> | null;

  // Set hash codes of CDATA tags: script, style, etc.
  cdataTags: Set<number> | null;

  // Map from (A) tag name hash code to a set of hash codes of tag names that implicitly end A
  implicitEndTagMap: Map<number, Set<number>> | null;

  implicitStartTags: Set<number> | null;

  // Reads hash code from the input string, defines if tags are compared in case-insensitive manner
  getHashCode(input: string, offset: number, length: number): number;
}
