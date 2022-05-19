export const enum LexerType {
  START_TAG = 'START_TAG',
  ATTRIBUTE_NAME = 'ATTRIBUTE_NAME',
  ATTRIBUTE_VALUE = 'ATTRIBUTE_VALUE',
  END_TAG = 'END_TAG',
  COMMENT = 'COMMENT',
  DTD = 'DTD',
  PROCESSING_INSTRUCTION = 'PROCESSING_INSTRUCTION',
  CDATA = 'CDATA',
  DOCTYPE = 'DOCTYPE',
  TEXT = 'TEXT',
}

export type LexerHandler = (type: LexerType, chunk: string, offset: number, length: number) => void;
