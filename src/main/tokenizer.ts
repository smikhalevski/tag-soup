import {all, char, createTokenizer, end, or, Reader, Rule, seq, skip, text, until} from 'tokenizer-dsl';
import {LexerContext, TokenStage, TokenType} from './lexer-types';

const untilInclusive = <Context>(reader: Reader<Context>): Reader<Context> => until(reader, {inclusive: true});

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

// …/>
const startTagSelfClosingReader = seq(slashReader, gtReader);

// </…
const endTagOpeningReader = seq(ltReader, slashReader, tagNameStartCharReader, tagNameCharsReader);

const endTagClosingReader = or(untilInclusive(gtReader), end());

const attributeNameReader = or(until(char([whitespaceChars, '/', '>', '='])), end());

// "…" or '…'
const attributeValueReader = or(
    seq(quotReader, or(untilInclusive(quotReader), end(1))),
    seq(aposReader, or(untilInclusive(aposReader), end(1))),
);

// okay
const attributeUnquotedValueReader = or(until(char([whitespaceChars, '>'])), end());

// <!-- … -->
const commentReader = seq(ltReader, exclReader, text('--'), or(untilInclusive(text('-->')), end(3)));

// <? … ?>
const processingInstructionReader = seq(ltReader, text('?'), or(untilInclusive(text('?>')), end(2)));

// <![CDATA[ … ]]>
const cdataReader = seq(ltReader, exclReader, text('[CDATA['), or(untilInclusive(text(']]>')), end(3)));

// <!DOCTYPE … >
const doctypeReader = seq(ltReader, exclReader, text('DOCTYPE', {caseInsensitive: true}), or(untilInclusive(gtReader), end(1)));

// <! … >
const dtdReader = seq(ltReader, exclReader, or(untilInclusive(gtReader), end(1)));

const textReader = seq(skip(1), or(until(ltReader), end()));

const startTagOpeningRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: TokenType.START_TAG_OPENING,
  reader: startTagOpeningReader,
  to: TokenStage.START_TAG_OPENING,
};

const startTagClosingRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.START_TAG_OPENING, TokenStage.ATTRIBUTE_NAME, TokenStage.ATTRIBUTE_EQ],
  type: TokenType.START_TAG_CLOSING,
  reader: gtReader,

  to(chunk, offset, length, context) {
    const {cdataTags} = context;
    return cdataTags !== null && cdataTags.has(context.state.activeTag) ? TokenStage.CDATA_TAG : TokenStage.DOCUMENT;
  },
};

const startTagSelfClosingRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.START_TAG_OPENING, TokenStage.ATTRIBUTE_NAME, TokenStage.ATTRIBUTE_EQ],
  type: TokenType.START_TAG_SELF_CLOSING,
  reader: startTagSelfClosingReader,

  to(chunk, offset, length, context) {
    if (context.selfClosingTagsEnabled) {
      return TokenStage.DOCUMENT;
    }
    const {cdataTags} = context;
    return cdataTags !== null && cdataTags.has(context.state.activeTag) ? TokenStage.CDATA_TAG : TokenStage.DOCUMENT;
  },
};

const tagSpaceRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.START_TAG_OPENING, TokenStage.ATTRIBUTE_NAME, TokenStage.ATTRIBUTE_EQ],
  reader: tagSpaceReader,
  silent: true,
};

const attributeNameRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.START_TAG_OPENING, TokenStage.ATTRIBUTE_NAME],
  type: TokenType.ATTRIBUTE_NAME,
  reader: attributeNameReader,
  to: TokenStage.ATTRIBUTE_NAME,
};

const attributeEqRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.ATTRIBUTE_NAME],
  reader: eqReader,
  to: TokenStage.ATTRIBUTE_EQ,
  silent: true,
};

const attributeValueRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.ATTRIBUTE_EQ],
  type: TokenType.ATTRIBUTE_VALUE,
  reader: attributeValueReader,
  to: TokenStage.START_TAG_OPENING,
};

const attributeUnquotedValueRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.ATTRIBUTE_EQ],
  type: TokenType.ATTRIBUTE_UNQUOTED_VALUE,
  reader: attributeUnquotedValueReader,
  to: TokenStage.START_TAG_OPENING,
};

const endTagOpeningRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT, TokenStage.CDATA_TAG],
  type: TokenType.END_TAG_OPENING,
  reader: endTagOpeningReader,

  to(chunk, offset, length, context, tokenizerState) {
    const {state} = context;
    const endTag = context.getHashCode(chunk, offset + 2, length - 2);

    const endTagCdataModeEnabled = context.endTagCdataModeEnabled = tokenizerState.stage === TokenStage.CDATA_TAG && state.stack[state.cursor] !== endTag;

    if (endTagCdataModeEnabled) {
      return TokenStage.CDATA_TAG;
    }
    state.activeTag = endTag;
    return TokenStage.END_TAG_OPENING;
  },
};

const endTagClosingRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.END_TAG_OPENING],
  type: TokenType.END_TAG_CLOSING,
  reader: endTagClosingReader,
  to: TokenStage.DOCUMENT,
};

const commentRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: TokenType.COMMENT,
  reader: commentReader,
};

const processingInstructionRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: TokenType.PROCESSING_INSTRUCTION,
  reader: processingInstructionReader,
};

const cdataRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: TokenType.CDATA_SECTION,
  reader: cdataReader,
};

const doctypeRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: TokenType.DOCTYPE,
  reader: doctypeReader,
};

const dtdRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT],
  type: TokenType.DTD,
  reader: dtdReader,
};

const textRule: Rule<TokenType, TokenStage, LexerContext> = {
  on: [TokenStage.DOCUMENT, TokenStage.CDATA_TAG],
  type: TokenType.TEXT,
  reader: textReader,
};

export const tokenizer = createTokenizer([
  startTagOpeningRule,
  attributeNameRule,
  attributeEqRule,
  attributeValueRule,
  attributeUnquotedValueRule,
  startTagClosingRule,
  startTagSelfClosingRule,
  tagSpaceRule,
  endTagOpeningRule,
  endTagClosingRule,
  commentRule,
  processingInstructionRule,
  cdataRule,
  doctypeRule,
  dtdRule,
  textRule,
], TokenStage.DOCUMENT);
