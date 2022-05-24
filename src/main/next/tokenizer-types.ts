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
  // activeTag
  START_TAG_OPENING = 'START_TAG_OPENING',

  // activeTag or stack[cursor]
  START_TAG_CLOSING = 'START_TAG_CLOSING',

  // activeTag or stack[cursor]
  START_TAG_SELF_CLOSING = 'START_TAG_SELF_CLOSING',

  ATTRIBUTE_NAME = 'ATTRIBUTE_NAME',
  ATTRIBUTE_VALUE = 'ATTRIBUTE_VALUE',
  ATTRIBUTE_UNQUOTED_VALUE = 'ATTRIBUTE_UNQUOTED_VALUE',

  // activeTag or stack[cursor]
  END_TAG_OPENING = 'END_TAG_OPENING',

  // activeTag or stack[cursor]
  END_TAG_CLOSING = 'END_TAG_CLOSING',

  // stack[cursor]
  IMPLICIT_END_TAG = 'IMPLICIT_END_TAG',

  // activeTag
  IMPLICIT_START_TAG = 'IMPLICIT_START_TAG',
  COMMENT = 'COMMENT',
  PROCESSING_INSTRUCTION = 'PROCESSING_INSTRUCTION',
  CDATA_SECTION = 'CDATA_SECTION',
  DOCTYPE = 'DOCTYPE',
  TEXT = 'TEXT',
  DTD = 'DTD',
}

export type LexerHandler = (type: TokenType, chunk: string, offset: number, length: number, state: LexerState) => void;

export interface LexerState extends TokenizerState<TokenStage> {

  /**
   * The list of tag name hash codes.
   */
  stack: number[];

  /**
   * The index in stack of the current tag.
   */
  cursor: number;

  /**
   * The hash code of the tag name, or 0 if not in a lexical context of a tag.
   */
  activeTag: number;
}

/**
 * The internal context used by the tokenizer and lexer.
 *
 * @internal
 */
export interface LexerContext {
  state: LexerState,
  handler: LexerHandler;
  selfClosingTagsEnabled: boolean;
  voidTags: Set<number> | null;
  cdataTags: Set<number> | null;
  implicitEndTagMap: Map<number, Set<number>> | null;
  implicitStartTags: Set<number> | null;

  getHashCode(input: string, offset: number, length: number): number;
}
