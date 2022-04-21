import {all, char, end, maybe, or, Reader, Rule, TokenHandler, seq, skip, text, Tokenizer, until} from 'tokenizer-dsl';

const untilInclusive = <C>(reader: Reader<C>): Reader<C> => until(reader, {inclusive: true});

// https://www.w3.org/TR/xml/#NT-NameStartChar
const tagNameStartCharReader = char([
  ['a'.charCodeAt(0), 'z'.charCodeAt(0)],
  ['A'.charCodeAt(0), 'Z'.charCodeAt(0)],
  '_',
  ':',
  [0xc0, 0xd6],
  [0xd8, 0xf6],
  [0xf8, 0x2ff],
  [0x370, 0x37d],
  [0x37f, 0x1fff],
  [0x200c, 0x200d],
  [0x2070, 0x218f],
  [0x2c00, 0x2fef],
  [0x3001, 0xd7ff],
  [0xf900, 0xfdcf],
  [0xfdf0, 0xfffd],
  [0x10000, 0xeffff],
]);

// https://www.w3.org/TR/xml/#NT-S
const spaceChars = ' \t\r\n';

const tagNameCharsReader = or(until(char([spaceChars, '/', '>'])), end());

const ltReader = text('<');

const gtReader = text('>');

const tagSpaceReader = seq(skip(1), all(char([spaceChars])));

const untilGtReader = untilInclusive(gtReader);

// <…
const startTagOpeningReader = seq(ltReader, tagNameStartCharReader, tagNameCharsReader);

// …/>
const startTagClosingReader = seq(maybe(text('/')), gtReader);

// </…
const endTagOpeningReader = seq(ltReader, text('/'), tagNameStartCharReader, tagNameCharsReader);

const attributeNameReader = or(until(char([spaceChars, '/', '>', '='])), end());

// =
const eqReader = text('=');

// "…"
const quotValueReader = seq(text('"'), or(untilInclusive(text('"')), end(1)));

// '…'
const aposValueReader = seq(text('\''), or(untilInclusive(text('\'')), end(1)));

// okay
const unquotedValueReader = or(until(char([spaceChars, '>'])), end());

// <!-- … -->
const commentReader = seq(ltReader, text('!--'), or(untilInclusive(text('-->')), end(3)));

// <! … >
const dtdReader = seq(ltReader, text('!'), or(untilInclusive(gtReader), end(1)));

// <? … ?>
const processingInstructionReader = seq(ltReader, text('?'), or(untilInclusive(text('?>')), end(2)));

// <![CDATA[ … ]]>
const cdataReader = seq(ltReader, text('![CDATA['), or(untilInclusive(text(']]>')), end(3)));

// <!DOCTYPE … >
const doctypeReader = seq(ltReader, text('!DOCTYPE', {caseInsensitive: true}), or(untilInclusive(gtReader), end(1)));

const textReader = seq(skip(1), or(until(text('<')), end()));

export const enum Stage {
  DOCUMENT,
  START_TAG_OPENING,
  ATTRIBUTE_NAME,
  ATTRIBUTE_EQ,
  END_TAG,
}

export const enum Type {
  START_TAG_OPENING = 'START_TAG_OPENING',
  START_TAG_CLOSING = 'START_TAG_CLOSING',
  ATTRIBUTE_NAME = 'ATTRIBUTE_NAME',
  ATTRIBUTE_EQ = 'ATTRIBUTE_EQ',
  ATTRIBUTE_QUOT_VALUE = 'ATTRIBUTE_QUOT_VALUE',
  ATTRIBUTE_APOS_VALUE = 'ATTRIBUTE_APOS_VALUE',
  TAG_SPACE = 'TAG_SPACE',
  ATTRIBUTE_UNQUOTED_VALUE = 'ATTRIBUTE_UNQUOTED_VALUE',
  END_TAG_OPENING = 'END_TAG_OPENING',
  END_TAG_CLOSING = 'END_TAG_CLOSING',
  COMMENT = 'COMMENT',
  DTD = 'DTD',
  PROCESSING_INSTRUCTION = 'PROCESSING_INSTRUCTION',
  CDATA = 'CDATA',
  DOCTYPE = 'DOCTYPE',
  TEXT = 'TEXT',
}

const startTagOpeningRule: Rule<Type, Stage, void> = {
  on: [Stage.DOCUMENT],
  type: Type.START_TAG_OPENING,
  reader: startTagOpeningReader,
  to: Stage.START_TAG_OPENING,
};

const startTagClosingRule: Rule<Type, Stage, void> = {
  on: [Stage.START_TAG_OPENING, Stage.ATTRIBUTE_NAME, Stage.ATTRIBUTE_EQ],
  type: Type.START_TAG_CLOSING,
  reader: startTagClosingReader,
  to: Stage.DOCUMENT,
};

const tagSpaceRule: Rule<Type, Stage, void> = {
  on: [Stage.START_TAG_OPENING, Stage.ATTRIBUTE_NAME, Stage.ATTRIBUTE_EQ],
  type: Type.TAG_SPACE,
  reader: tagSpaceReader,
  silent: true,
};

const attributeNameRule: Rule<Type, Stage, void> = {
  on: [Stage.START_TAG_OPENING, Stage.ATTRIBUTE_NAME],
  type: Type.ATTRIBUTE_NAME,
  reader: attributeNameReader,
  to: Stage.ATTRIBUTE_NAME,
};

const attributeEqRule: Rule<Type, Stage, void> = {
  on: [Stage.ATTRIBUTE_NAME],
  type: Type.ATTRIBUTE_EQ,
  reader: eqReader,
  to: Stage.ATTRIBUTE_EQ,
  silent: true,
};

const attributeQuotValueRule: Rule<Type, Stage, void> = {
  on: [Stage.ATTRIBUTE_EQ],
  type: Type.ATTRIBUTE_QUOT_VALUE,
  reader: quotValueReader,
  to: Stage.START_TAG_OPENING,
};

const attributeAposValueRule: Rule<Type, Stage, void> = {
  on: [Stage.ATTRIBUTE_EQ],
  type: Type.ATTRIBUTE_APOS_VALUE,
  reader: aposValueReader,
  to: Stage.START_TAG_OPENING,
};

const attributeUnquotedValueRule: Rule<Type, Stage, void> = {
  on: [Stage.ATTRIBUTE_EQ],
  type: Type.ATTRIBUTE_UNQUOTED_VALUE,
  reader: unquotedValueReader,
  to: Stage.START_TAG_OPENING,
};

const endTagOpeningRule: Rule<Type, Stage, void> = {
  on: [Stage.DOCUMENT],
  type: Type.END_TAG_OPENING,
  reader: endTagOpeningReader,
  to: Stage.END_TAG,
};

const endTagClosingRule: Rule<Type, Stage, void> = {
  on: [Stage.END_TAG],
  type: Type.END_TAG_CLOSING,
  reader: untilGtReader,
  to: Stage.DOCUMENT,
};

const commentRule: Rule<Type, Stage, void> = {
  on: [Stage.DOCUMENT],
  type: Type.COMMENT,
  reader: commentReader,
};

const dtdRule: Rule<Type, Stage, void> = {
  on: [Stage.DOCUMENT],
  type: Type.DTD,
  reader: dtdReader,
};

const processingInstructionRule: Rule<Type, Stage, void> = {
  on: [Stage.DOCUMENT],
  type: Type.PROCESSING_INSTRUCTION,
  reader: processingInstructionReader,
};

const cdataRule: Rule<Type, Stage, void> = {
  on: [Stage.DOCUMENT],
  type: Type.CDATA,
  reader: cdataReader,
};

const doctypeRule: Rule<Type, Stage, void> = {
  on: [Stage.DOCUMENT],
  type: Type.DOCTYPE,
  reader: doctypeReader,
};

const textRule: Rule<Type, Stage, void> = {
  on: [Stage.DOCUMENT],
  type: Type.TEXT,
  reader: textReader,
};

export function createTokenizer(handler: TokenHandler<Type>): Tokenizer<Type, Stage, void> {
  return new Tokenizer([
    startTagOpeningRule,
    attributeNameRule,
    attributeEqRule,
    attributeQuotValueRule,
    attributeAposValueRule,
    attributeUnquotedValueRule,
    startTagClosingRule,
    tagSpaceRule,
    endTagOpeningRule,
    endTagClosingRule,
    commentRule,
    dtdRule,
    processingInstructionRule,
    cdataRule,
    doctypeRule,
    textRule,
  ], handler, undefined, Stage.DOCUMENT);
}
