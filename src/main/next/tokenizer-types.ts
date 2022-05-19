import {LexerHandler} from './lexer-types';

export const enum Stage {
  DOCUMENT,
  START_TAG_OPENING,
  ATTRIBUTE_NAME,
  ATTRIBUTE_EQ,
  END_TAG,
  CDATA_TAG,
}

export const enum Type {
  START_TAG_OPENING = 'START_TAG_OPENING',
  START_TAG_CLOSING = 'START_TAG_CLOSING',
  ATTRIBUTE_NAME = 'ATTRIBUTE_NAME',
  // ATTRIBUTE_EQ = 'ATTRIBUTE_EQ',
  ATTRIBUTE_QUOT_VALUE = 'ATTRIBUTE_QUOT_VALUE',
  ATTRIBUTE_APOS_VALUE = 'ATTRIBUTE_APOS_VALUE',
  ATTRIBUTE_UNQUOTED_VALUE = 'ATTRIBUTE_UNQUOTED_VALUE',
  // TAG_SPACE = 'TAG_SPACE',
  END_TAG_OPENING = 'END_TAG_OPENING',
  // END_TAG_CLOSING = 'END_TAG_CLOSING',
  COMMENT = 'COMMENT',
  PROCESSING_INSTRUCTION = 'PROCESSING_INSTRUCTION',
  CDATA_SECTION = 'CDATA_SECTION',
  DOCTYPE = 'DOCTYPE',
  TEXT = 'TEXT',
}

export interface Context {

  handler: LexerHandler;

  // List of tag name hash codes
  stack: number[];

  // The current position in the stack
  cursor: number;

  lastTag: number;

  cdataMode: boolean;

  selfClosingTagsEnabled: boolean;

  // Set hash codes of void tags: img, br, etc.
  voidTags: Set<number> | null;

  // Set hash codes of CDATA tags: script, style, etc.
  cdataTags: Set<number> | null;

  // Map from (A) tag name hash code to a set of hash codes of tag names that implicitly end A
  wrestTags: Map<number, Set<number>> | null;

  // Reads hash code from the input string, defines if tags are compared in case-insensitive manner
  hashCodeAt: (input: string, offset: number, length: number) => number;
}
