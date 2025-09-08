import fs from 'fs';
import path from 'path';
import * as t from 'tokenizer-dsl';
import { LexerContext, LexerStage, TokenType } from '../main/lexer-types';

function untilInclusive<C>(reader: t.Reader<C>): t.Reader<C> {
  return t.until(reader, { inclusive: true });
}

const startTagClosingRuleTo = t.externalValue('../lexer-utils', 'startTagClosingRuleTo');

const startTagSelfClosingRuleTo = t.externalValue('../lexer-utils', 'startTagSelfClosingRuleTo');

const endTagOpeningRuleTo = t.externalValue('../lexer-utils', 'endTagOpeningRuleTo');

// https://www.w3.org/TR/xml/#NT-NameStartChar
const tagNameStartCharReader = t.char([
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

const tagNameCharsReader = t.or(t.until(t.char([whitespaceChars, '/', '>'])), t.end());

const ltReader = t.text('<');

const gtReader = t.text('>');

const exclReader = t.text('!');

const quotReader = t.text('"');

const aposReader = t.text("'");

const eqReader = t.text('=');

const slashReader = t.text('/');

const tagSpaceReader = t.seq(t.skip(1), t.all(t.char([whitespaceChars])));

// <…
const startTagOpeningReader = t.seq(ltReader, tagNameStartCharReader, tagNameCharsReader);

// …/>
const startTagSelfClosingReader = t.seq(slashReader, gtReader);

// </…
const endTagOpeningReader = t.seq(ltReader, slashReader, tagNameStartCharReader, tagNameCharsReader);

const endTagClosingReader = t.or(untilInclusive(gtReader), t.end());

const attributeNameReader = t.or(t.until(t.char([whitespaceChars, '/', '>', '='])), t.end());

// "…" or '…'
const attributeValueReader = t.or(
  t.seq(quotReader, t.or(untilInclusive(quotReader), t.end(1))),
  t.seq(aposReader, t.or(untilInclusive(aposReader), t.end(1)))
);

// okay
const attributeUnquotedValueReader = t.or(t.until(t.char([whitespaceChars, '>'])), t.end());

// <!-- … -->
const commentReader = t.seq(ltReader, exclReader, t.text('--'), t.or(untilInclusive(t.text('-->')), t.end(3)));

// <? … ?>
const processingInstructionReader = t.seq(ltReader, t.text('?'), t.or(untilInclusive(t.text('?>')), t.end(2)));

// <![CDATA[ … ]]>
const cdataReader = t.seq(ltReader, exclReader, t.text('[CDATA['), t.or(untilInclusive(t.text(']]>')), t.end(3)));

// <!DOCTYPE … >
const doctypeReader = t.seq(
  ltReader,
  exclReader,
  t.text('DOCTYPE', { caseInsensitive: true }),
  t.or(untilInclusive(gtReader), t.end(1))
);

// <! … >
const dtdReader = t.seq(ltReader, exclReader, t.or(untilInclusive(gtReader), t.end(1)));

const textReader = t.seq(t.skip(1), t.or(t.until(ltReader), t.end()));

const startTagOpeningRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: 'START_TAG_OPENING',
  reader: startTagOpeningReader,
  to: LexerStage.START_TAG,
};

const startTagClosingRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.START_TAG, LexerStage.ATTRIBUTE_NAME, LexerStage.ATTRIBUTE_VALUE],
  type: 'START_TAG_CLOSING',
  reader: gtReader,
  to: startTagClosingRuleTo,
};

const startTagSelfClosingRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.START_TAG, LexerStage.ATTRIBUTE_NAME, LexerStage.ATTRIBUTE_VALUE],
  type: 'START_TAG_SELF_CLOSING',
  reader: startTagSelfClosingReader,
  to: startTagSelfClosingRuleTo,
};

const tagSpaceRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.START_TAG, LexerStage.ATTRIBUTE_NAME, LexerStage.ATTRIBUTE_VALUE],
  reader: tagSpaceReader,
  silent: true,
};

const attributeNameRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.START_TAG, LexerStage.ATTRIBUTE_NAME],
  type: 'ATTRIBUTE_NAME',
  reader: attributeNameReader,
  to: LexerStage.ATTRIBUTE_NAME,
};

const attributeEqRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.ATTRIBUTE_NAME],
  reader: eqReader,
  to: LexerStage.ATTRIBUTE_VALUE,
  silent: true,
};

const attributeValueRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.ATTRIBUTE_VALUE],
  type: 'ATTRIBUTE_VALUE',
  reader: attributeValueReader,
  to: LexerStage.START_TAG,
};

const attributeUnquotedValueRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.ATTRIBUTE_VALUE],
  type: 'ATTRIBUTE_UNQUOTED_VALUE',
  reader: attributeUnquotedValueReader,
  to: LexerStage.START_TAG,
};

const endTagOpeningRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT, LexerStage.CDATA_TAG],
  type: 'END_TAG_OPENING',
  reader: endTagOpeningReader,
  to: endTagOpeningRuleTo,
};

const endTagClosingRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.END_TAG],
  type: 'END_TAG_CLOSING',
  reader: endTagClosingReader,
  to: LexerStage.DOCUMENT,
};

const commentRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: 'COMMENT',
  reader: commentReader,
};

const processingInstructionRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: 'PROCESSING_INSTRUCTION',
  reader: processingInstructionReader,
};

const cdataRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: 'CDATA_SECTION',
  reader: cdataReader,
};

const doctypeRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: 'DOCTYPE',
  reader: doctypeReader,
};

const dtdRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT],
  type: 'DTD',
  reader: dtdReader,
};

const textRule: t.Rule<TokenType, LexerStage, LexerContext> = {
  on: [LexerStage.DOCUMENT, LexerStage.CDATA_TAG],
  type: 'TEXT',
  reader: textReader,
};

const moduleSource = t.compileRuleIteratorModule(
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
