import {all, char, createTokenizer, end, maybe, or, Reader, Rule, seq, skip, text, until} from 'tokenizer-dsl';
import {Context, Stage, Type} from './tokenizer-types';

const untilInclusive = <Context, Error>(reader: Reader<Context, Error>): Reader<Context, Error> => until(reader, {inclusive: true});

// https://www.w3.org/TR/xml/#NT-NameStartChar
const tagNameStartCharReader = char([
  ['a', 'z'],
  ['A', 'Z'],
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

// <…
const startTagOpeningReader = seq(ltReader, tagNameStartCharReader, tagNameCharsReader);

// …/>
const startTagClosingReader = seq(maybe(text('/')), gtReader);

// </…
const endTagOpeningReader = seq(ltReader, text('/'), tagNameStartCharReader, tagNameCharsReader);

const endTagClosingReader = untilInclusive(gtReader);

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

// <? … ?>
const processingInstructionReader = seq(ltReader, text('?'), or(untilInclusive(text('?>')), end(2)));

// <![CDATA[ … ]]>
const cdataReader = seq(ltReader, text('![CDATA['), or(untilInclusive(text(']]>')), end(3)));

// <!DOCTYPE … >
const doctypeReader = seq(ltReader, text('!DOCTYPE', {caseInsensitive: true}), or(untilInclusive(gtReader), end(1)));

const textReader = seq(skip(1), or(until(text('<')), end()));

const startTagOpeningRule: Rule<Type, Stage, Context> = {
  on: [Stage.DOCUMENT],
  type: Type.START_TAG_OPENING,
  reader: startTagOpeningReader,
  to: Stage.START_TAG_OPENING,
};

const startTagClosingRule: Rule<Type, Stage, Context> = {
  on: [Stage.START_TAG_OPENING, Stage.ATTRIBUTE_NAME, Stage.ATTRIBUTE_EQ],
  type: Type.START_TAG_CLOSING,
  reader: startTagClosingReader,

  to(chunk, offset, length, context) {
    return context.cdataMode ? Stage.CDATA_TAG : Stage.DOCUMENT;
  },
};

const tagSpaceRule: Rule<Type, Stage, Context> = {
  on: [Stage.START_TAG_OPENING, Stage.ATTRIBUTE_NAME, Stage.ATTRIBUTE_EQ],
  // type: Type.TAG_SPACE,
  reader: tagSpaceReader,
  silent: true,
};

const attributeNameRule: Rule<Type, Stage, Context> = {
  on: [Stage.START_TAG_OPENING, Stage.ATTRIBUTE_NAME],
  type: Type.ATTRIBUTE_NAME,
  reader: attributeNameReader,
  to: Stage.ATTRIBUTE_NAME,
};

const attributeEqRule: Rule<Type, Stage, Context> = {
  on: [Stage.ATTRIBUTE_NAME],
  // type: Type.ATTRIBUTE_EQ,
  reader: eqReader,
  to: Stage.ATTRIBUTE_EQ,
  silent: true,
};

const attributeQuotValueRule: Rule<Type, Stage, Context> = {
  on: [Stage.ATTRIBUTE_EQ],
  type: Type.ATTRIBUTE_QUOT_VALUE,
  reader: quotValueReader,
  to: Stage.START_TAG_OPENING,
};

const attributeAposValueRule: Rule<Type, Stage, Context> = {
  on: [Stage.ATTRIBUTE_EQ],
  type: Type.ATTRIBUTE_APOS_VALUE,
  reader: aposValueReader,
  to: Stage.START_TAG_OPENING,
};

const attributeUnquotedValueRule: Rule<Type, Stage, Context> = {
  on: [Stage.ATTRIBUTE_EQ],
  type: Type.ATTRIBUTE_UNQUOTED_VALUE,
  reader: unquotedValueReader,
  to: Stage.START_TAG_OPENING,
};

const endTagOpeningRule: Rule<Type, Stage, Context> = {
  on: [Stage.DOCUMENT, Stage.CDATA_TAG],
  type: Type.END_TAG_OPENING,
  reader: endTagOpeningReader,

  to(chunk, offset, length, context) {
    const endTag = context.hashCodeAt(chunk, offset + 2, length - 2);

    if (!context.cdataMode) {
      context.lastTag = endTag;
      return Stage.END_TAG;
    }
    if (context.lastTag !== endTag) {
      return Stage.CDATA_TAG;
    }
    context.lastTag = endTag;
    context.cdataMode = false;
    return Stage.END_TAG;
  },
};

const endTagClosingRule: Rule<Type, Stage, Context> = {
  on: [Stage.END_TAG],
  // type: Type.END_TAG_CLOSING,
  reader: endTagClosingReader,
  to: Stage.DOCUMENT,
  silent: true,
};

const commentRule: Rule<Type, Stage, Context> = {
  on: [Stage.DOCUMENT],
  type: Type.COMMENT,
  reader: commentReader,
};

const processingInstructionRule: Rule<Type, Stage, Context> = {
  on: [Stage.DOCUMENT],
  type: Type.PROCESSING_INSTRUCTION,
  reader: processingInstructionReader,
};

const cdataRule: Rule<Type, Stage, Context> = {
  on: [Stage.DOCUMENT],
  type: Type.CDATA_SECTION,
  reader: cdataReader,
  to: Stage.CDATA_TAG,
};

const doctypeRule: Rule<Type, Stage, Context> = {
  on: [Stage.DOCUMENT],
  type: Type.DOCTYPE,
  reader: doctypeReader,
};

const textRule: Rule<Type, Stage, Context> = {
  on: [Stage.DOCUMENT, Stage.CDATA_TAG],
  type: Type.TEXT,
  reader: textReader,
};

export const tokenizer = createTokenizer([
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
  processingInstructionRule,
  cdataRule,
  doctypeRule,
  textRule,
], Stage.DOCUMENT);
