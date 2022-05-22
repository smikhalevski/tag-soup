import {all, char, createTokenizer, end, maybe, or, Rule, seq, skip, text, until} from 'tokenizer-dsl';
import {LexerContext, Type, TokenStage} from './tokenizer-types';

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
const whitespaceChars = ' \t\r\n';

const tagNameCharsReader = or(until(char([whitespaceChars, '/', '>'])), end());

const ltReader = text('<');

const gtReader = text('>');

const exclReader = text('!');

const quotReader = text('"');

const aposReader = text('\'');

const eqReader = text('=');

const slashReader = text('/');

const tagSpaceReader = seq(skip(1), all(char([whitespaceChars])));

// <…
const startTagOpeningReader = seq(ltReader, tagNameStartCharReader, tagNameCharsReader);

// …> or …/>
const startTagClosingReader = seq(maybe(slashReader), gtReader);

// </…
const endTagOpeningReader = seq(ltReader, slashReader, tagNameStartCharReader, tagNameCharsReader);

const endTagClosingReader = or(until(gtReader, {inclusive: true}), end());

const attributeNameReader = or(until(char([whitespaceChars, '/', '>', '='])), end());

// "…" or '…'
const attributeEnquotedValueReader = or(
    seq(quotReader, or(until(quotReader, {inclusive: true}), end(1))),
    seq(aposReader, or(until(aposReader, {inclusive: true}), end(1))),
);

// okay
const attributeUnquotedValueReader = or(until(char([whitespaceChars, '>'])), end());

// <!-- … -->
const commentReader = seq(ltReader, exclReader, text('--'), or(until(text('-->'), {inclusive: true}), end(3)));

// <? … ?>
const processingInstructionReader = seq(ltReader, text('?'), or(until(text('?>'), {inclusive: true}), end(2)));

// <![CDATA[ … ]]>
const cdataReader = seq(ltReader, exclReader, text('[CDATA['), or(until(text(']]>'), {inclusive: true}), end(3)));

// <!DOCTYPE … >
const doctypeReader = seq(ltReader, exclReader, text('DOCTYPE', {caseInsensitive: true}), or(until(gtReader, {inclusive: true}), end(1)));

const textReader = seq(skip(1), or(until(ltReader), end()));

const startTagOpeningRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: Type.START_TAG_OPENING,
  reader: startTagOpeningReader,
  to: TokenStage.START_TAG_OPENING,
};

const startTagClosingRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.START_TAG_OPENING, TokenStage.ATTRIBUTE_NAME, TokenStage.ATTRIBUTE_EQ],
  type: Type.START_TAG_CLOSING,
  reader: startTagClosingReader,

  to(chunk, offset, length, context) {
    return context.cdataMode ? TokenStage.CDATA_TAG : TokenStage.DOCUMENT;
  },
};

const tagSpaceRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.START_TAG_OPENING, TokenStage.ATTRIBUTE_NAME, TokenStage.ATTRIBUTE_EQ],
  reader: tagSpaceReader,
  silent: true,
};

const attributeNameRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.START_TAG_OPENING, TokenStage.ATTRIBUTE_NAME],
  type: Type.ATTRIBUTE_NAME,
  reader: attributeNameReader,
  to: TokenStage.ATTRIBUTE_NAME,
};

const attributeEqRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.ATTRIBUTE_NAME],
  reader: eqReader,
  to: TokenStage.ATTRIBUTE_EQ,
  silent: true,
};

const attributeEnquotedValueRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.ATTRIBUTE_EQ],
  type: Type.ATTRIBUTE_ENQUOTED_VALUE,
  reader: attributeEnquotedValueReader,
  to: TokenStage.START_TAG_OPENING,
};

const attributeUnquotedValueRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.ATTRIBUTE_EQ],
  type: Type.ATTRIBUTE_UNQUOTED_VALUE,
  reader: attributeUnquotedValueReader,
  to: TokenStage.START_TAG_OPENING,
};

const endTagOpeningRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT, TokenStage.CDATA_TAG],
  type: Type.END_TAG_OPENING,
  reader: endTagOpeningReader,

  to(chunk, offset, length, context) {
    const endTag = context.hashCodeAt(chunk, offset + 2, length - 2);

    if (!context.cdataMode) {
      context.lastTag = endTag;
      return TokenStage.END_TAG;
    }
    if (context.lastTag !== endTag) {
      return TokenStage.CDATA_TAG;
    }
    context.lastTag = endTag;
    context.cdataMode = false;
    return TokenStage.END_TAG;
  },
};

const endTagClosingRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.END_TAG],
  type: Type.END_TAG_CLOSING,
  reader: endTagClosingReader,
  to: TokenStage.DOCUMENT,
};

const commentRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: Type.COMMENT,
  reader: commentReader,
};

const processingInstructionRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: Type.PROCESSING_INSTRUCTION,
  reader: processingInstructionReader,
};

const cdataRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: Type.CDATA_SECTION,
  reader: cdataReader,
  to: TokenStage.CDATA_TAG,
};

const doctypeRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: Type.DOCTYPE,
  reader: doctypeReader,
};

const textRule: Rule<Type, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT, TokenStage.CDATA_TAG],
  type: Type.TEXT,
  reader: textReader,
};

export const tokenizer = createTokenizer([
  startTagOpeningRule,
  attributeNameRule,
  attributeEqRule,
  attributeEnquotedValueRule,
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
], TokenStage.DOCUMENT);
