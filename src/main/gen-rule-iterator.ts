import fs from 'fs';
import path from 'path';
import {
  all,
  char,
  compileRuleIteratorModule,
  end,
  externalValue,
  or,
  Reader,
  Rule,
  seq,
  skip,
  text,
  until,
} from 'tokenizer-dsl';
import { LexerContext, LexerStage, TokenType } from './lexer-types';

function untilInclusive<C>(reader: Reader<C>): Reader<C> {
  return until(reader, { inclusive: true });
}

const startTagClosingRuleTo = externalValue('../lexer-utils', 'startTagClosingRuleTo');

const startTagSelfClosingRuleTo = externalValue('../lexer-utils', 'startTagSelfClosingRuleTo');

const endTagOpeningRuleTo = externalValue('../lexer-utils', 'endTagOpeningRuleTo');

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

const aposReader = text("'");

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
  seq(aposReader, or(untilInclusive(aposReader), end(1)))
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
const doctypeReader = seq(
  ltReader,
  exclReader,
  text('DOCTYPE', { caseInsensitive: true }),
  or(untilInclusive(gtReader), end(1))
);

// <! … >
const dtdReader = seq(ltReader, exclReader, or(untilInclusive(gtReader), end(1)));

const textReader = seq(skip(1), or(until(ltReader), end()));

const startTagOpeningRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: TokenType.START_TAG_OPENING,
  reader: startTagOpeningReader,
  to: LexerStage.START_TAG,
};

const startTagClosingRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.START_TAG, LexerStage.ATTRIBUTE_NAME, LexerStage.ATTRIBUTE_VALUE],
  type: TokenType.START_TAG_CLOSING,
  reader: gtReader,
  to: startTagClosingRuleTo,
};

const startTagSelfClosingRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.START_TAG, LexerStage.ATTRIBUTE_NAME, LexerStage.ATTRIBUTE_VALUE],
  type: TokenType.START_TAG_SELF_CLOSING,
  reader: startTagSelfClosingReader,
  to: startTagSelfClosingRuleTo,
};

const tagSpaceRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.START_TAG, LexerStage.ATTRIBUTE_NAME, LexerStage.ATTRIBUTE_VALUE],
  reader: tagSpaceReader,
  silent: true,
};

const attributeNameRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.START_TAG, LexerStage.ATTRIBUTE_NAME],
  type: TokenType.ATTRIBUTE_NAME,
  reader: attributeNameReader,
  to: LexerStage.ATTRIBUTE_NAME,
};

const attributeEqRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.ATTRIBUTE_NAME],
  reader: eqReader,
  to: LexerStage.ATTRIBUTE_VALUE,
  silent: true,
};

const attributeValueRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.ATTRIBUTE_VALUE],
  type: TokenType.ATTRIBUTE_VALUE,
  reader: attributeValueReader,
  to: LexerStage.START_TAG,
};

const attributeUnquotedValueRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.ATTRIBUTE_VALUE],
  type: TokenType.ATTRIBUTE_UNQUOTED_VALUE,
  reader: attributeUnquotedValueReader,
  to: LexerStage.START_TAG,
};

const endTagOpeningRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT, LexerStage.CDATA_TAG],
  type: TokenType.END_TAG_OPENING,
  reader: endTagOpeningReader,
  to: endTagOpeningRuleTo,
};

const endTagClosingRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.END_TAG],
  type: TokenType.END_TAG_CLOSING,
  reader: endTagClosingReader,
  to: LexerStage.DOCUMENT,
};

const commentRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: TokenType.COMMENT,
  reader: commentReader,
};

const processingInstructionRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: TokenType.PROCESSING_INSTRUCTION,
  reader: processingInstructionReader,
};

const cdataRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: TokenType.CDATA_SECTION,
  reader: cdataReader,
};

const doctypeRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: TokenType.DOCTYPE,
  reader: doctypeReader,
};

const dtdRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: TokenType.DTD,
  reader: dtdReader,
};

const textRule: Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT, LexerStage.CDATA_TAG],
  type: TokenType.TEXT,
  reader: textReader,
};

const moduleSource = compileRuleIteratorModule(
  [
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
  ],
  { typingsEnabled: true }
);

const modulePath = path.resolve(process.argv[2]);

fs.mkdirSync(path.dirname(modulePath), { recursive: true });

fs.writeFileSync(modulePath, moduleSource);
