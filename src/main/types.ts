import type { Tokenizer } from './createTokenizer.ts';

/**
 * The kind of a tag, which defines what the tag can contain, and how parsers read it and serializers write it:
 *
 * <dl>
 * <dt><code>normal</code></dt>
 * <dd>Tag can contain tags and text. Parsers decode this text with {@link ParserOptions.decodeText}, and serializers
 * encode it with {@link SerializerOptions.encodeText}.</dd>
 * <dt><code>void</code></dt>
 * <dd>Tag can contain nothing. Tokenizers insert an end tag right after the start tag, and serializers write an element
 * without children as a start tag only.</dd>
 * <dt><code>raw_text</code></dt>
 * <dd>Tag can contain text up to the matching end tag. Parsers don't decode this text, and serializers write it as
 * is.</dd>
 * <dt><code>escapable_raw_text</code></dt>
 * <dd>Same as <code>raw_text</code>, but parsers decode the text, and serializers encode it.</dd>
 * <dt><code>script_data</code></dt>
 * <dd>Same as <code>raw_text</code>, but after <code>&lt;!--</code> a start tag of the same name hides end tags until
 * its own end tag or <code>--&gt;</code>. Browsers read <code>script</code> this way for compatibility with old scripts
 * wrapped in comments:</dd>
 * </dl>
 *
 * ```html
 * <script><!--<script></script></script>
 *                              ▔▔▔▔▔▔▔▔▔ Ends the script
 * ```
 *
 * In raw text of any kind, an end tag must be followed by a space, `/` or `>`, so `</script` at the end of the input is
 * text.
 *
 * @see [HTML Normal Elements](https://html.spec.whatwg.org/multipage/syntax.html#normal-elements)
 * @see [HTML Void Elements](https://html.spec.whatwg.org/multipage/syntax.html#void-elements)
 * @see [HTML Raw Text Elements](https://html.spec.whatwg.org/multipage/syntax.html#raw-text-elements)
 * @see [HTML Escapable Raw Text Elements](https://html.spec.whatwg.org/multipage/syntax.html#escapable-raw-text-elements)
 * @see [HTML Script Data State](https://html.spec.whatwg.org/multipage/parsing.html#script-data-state)
 * @group Tokenizer
 */
export type TagKind = 'normal' | 'void' | 'raw_text' | 'escapable_raw_text' | 'script_data';

/**
 * The syntax that processing instructions are read with:
 *
 * <dl>
 * <dt><code>comment</code></dt>
 * <dd>Processing instructions aren't recognized, and are treated as comments.</dd>
 * <dt><code>xml</code></dt>
 * <dd>Processing instructions are recognized by XML rules (<code>&lt;?target data?&gt;</code>).</dd>
 * <dt><code>html</code></dt>
 * <dd>Processing instructions are recognized by HTML rules (<code>&lt;?target data&gt;</code>). The target is an ASCII
 * letter or <code>&#95;</code> followed by ASCII letters, digits, <code>-</code> and <code>&#95;</code>, and the data
 * ends at the first <code>&gt;</code>, without a <code>?</code> before it. Instructions with an invalid target, or with
 * the target <code>xml</code> or <code>xml-stylesheet</code>, are treated as comments, and an unclosed instruction at
 * the end of the input is ignored.</dd>
 * </dl>
 *
 * @see [XML Processing Instructions](https://www.w3.org/TR/xml/#sec-pi)
 * @see [HTML Processing Instruction Open State](https://html.spec.whatwg.org/multipage/parsing.html#processing-instruction-open-state)
 * @group Tokenizer
 */
export type ProcessingInstructionSyntax = 'comment' | 'xml' | 'html';

/**
 * Options of a tag that tokenizers and parsers use.
 *
 * @see {@link TokenizerContextOptions.tags}
 * @see {@link TagSerializationOptions}
 * @group Tokenizer
 */
export interface TagParsingOptions {
  /**
   * The kind of the tag.
   *
   * @see {@link TagKind}
   * @default 'normal'
   */
  kind?: TagKind;

  /**
   * Options of the context that the content of the tag is read in. A tag with these options is a foreign tag. Outer
   * options are restored when the tag is ended. Foreign options don't inherit outer options, but options can reference
   * each other, so foreign content may contain tags that switch back to outer options.
   *
   * The foreign tag itself is self-closing if either options recognize self-closing tags.
   *
   * For example, in HTML `svg` content is read with XML rules, while `foreignObject` inside `svg` switches back to HTML
   * rules:
   *
   * ```ts
   * const svgOptions: TokenizerContextOptions = {
   *   areSelfClosingTagsRecognized: true,
   * };
   *
   * const htmlOptions: TokenizerOptions = {
   *   tags: {
   *     br: { kind: 'void' },
   *     svg: { foreignContext: svgOptions },
   *   },
   * };
   *
   * svgOptions.tags = {
   *   foreignObject: { foreignContext: htmlOptions }
   * };
   * ```
   */
  foreignContext?: TokenizerContextOptions;

  /**
   * The list of tags that implicitly end this tag when they are started.
   *
   * For example, in HTML `p` is implicitly ended by `h1`:
   *
   * ```html
   * <p><h1>  →  <p></p><h1></h1>
   *                ▔▔▔▔ p is implicitly ended by h1
   * ```
   *
   * To achieve this behavior, set {@link TokenizerContextOptions.tags tags} to:
   *
   * ```ts
   * { p: { implicitEndingTagNames: ['h1'] } }
   * ```
   *
   * Tags are ended by name in any context. A tag inside a {@link foreignContext foreign tag} can end the foreign tag,
   * and then it's read with tags of the outer options. For example, in HTML `svg` is implicitly ended by `br`:
   *
   * ```html
   * <svg><br>text  →  <svg></svg><br>text
   *                        ▔▔▔▔▔▔ svg is implicitly ended by br
   * ```
   *
   * To achieve this behavior, set {@link TokenizerContextOptions.tags tags} to:
   *
   * ```ts
   * {
   *   svg: {
   *     implicitEndingTagNames: ['br'],
   *     foreignContext: {},
   *   },
   *   br: { kind: 'void' },
   * }
   * ```
   *
   * @see {@link isImplicitEndingScope}
   */
  implicitEndingTagNames?: Iterable<string>;

  /**
   * If `true` then the tag is an implicit ending scope: tags that are started inside this tag don't
   * {@link implicitEndingTagNames implicitly end} tags outside of it. A scope that is implicitly ended itself
   * doesn't limit anything.
   *
   * For example, in HTML `li` is implicitly ended by `li`, but only inside the nearest list:
   *
   * ```html
   * <ul><li><ul><li>  →  <ul><li><ul><li></li></ul></li></ul>
   *                                  ▔▔▔▔ Outer li isn't ended by the nested li
   * ```
   *
   * To achieve this behavior, set {@link TokenizerContextOptions.tags tags} to:
   *
   * ```ts
   * {
   *   li: { implicitEndingTagNames: ['li'] },
   *   ul: { isImplicitEndingScope: true },
   *   ol: { isImplicitEndingScope: true },
   * }
   * ```
   *
   * @default false
   */
  isImplicitEndingScope?: boolean;

  /**
   * If `true` then a start tag is inserted before an unbalanced end tag of this tag. Otherwise, the end tag is ignored
   * or rejected, see {@link TokenizerOptions.areUnbalancedEndTagsIgnored}.
   *
   * For example, in HTML `p` and `br` tags follow these semantics:
   *
   * ```html
   * </p>   →  <p></p>
   *           ▔▔▔ p is implicitly started
   *
   * </br>  →  <br>
   *           ▔▔▔▔ br is implicitly started
   * ```
   *
   * To achieve this behavior, set {@link TokenizerContextOptions.tags tags} to:
   *
   * ```ts
   * {
   *   p: {
   *     isImplicitlyStarted: true
   *   },
   *   br: {
   *     kind: 'void',
   *     isImplicitlyStarted: true
   *   },
   * }
   * ```
   *
   * An end tag of an implicitly started tag doesn't end the tag across an
   * {@link isImplicitEndingScope implicit ending scope} that its start tag doesn't end. A start tag is inserted
   * instead:
   *
   * ```html
   * <p><button></p>  →  <p><button><p></p></button></p>
   * ```
   *
   * @default false
   */
  isImplicitlyStarted?: boolean;

  /**
   * The end tag scope level of the tag. An end tag of an enclosing tag doesn't end this tag and the tags inside it if
   * this level is higher than the level of the enclosing tag. Such an end tag is unbalanced.
   *
   * For example, in HTML an end tag inside a table cell can't end tags outside the table, but the end tag of a row ends
   * the cell, and the end tag of a table ends rows and cells:
   *
   * ```html
   * <div><table><tr><td></div>aaa  →  <div><table><tr><td>aaa</td></tr></table></div>
   *                     ▔▔▔▔▔▔ Ignored, so "aaa" stays in the cell
   * ```
   *
   * Without end tag scope levels, the end tag of `div` ends the cell, the row and the table:
   *
   * ```html
   * <div><table><tr><td></div>aaa  →  <div><table><tr><td></td></tr></table></div>aaa
   *                     ▔▔▔▔▔▔ Ends div, so "aaa" follows it
   * ```
   *
   * To achieve this behavior, set {@link TokenizerContextOptions.tags tags} to:
   *
   * ```ts
   * {
   *   td: { endTagScopeLevel: 1 },
   *   tr: { endTagScopeLevel: 1 },
   *   table: { endTagScopeLevel: 2 },
   * }
   * ```
   *
   * @see [HTML Has An Element In Scope](https://html.spec.whatwg.org/multipage/parsing.html#has-an-element-in-scope)
   * @default 0
   */
  endTagScopeLevel?: number;
}

/**
 * Options of a tag that serializers use.
 *
 * @see {@link SerializerOptions.tags}
 * @group Serializer
 */
export interface TagSerializationOptions {
  /**
   * The kind of the tag.
   *
   * @see {@link TagKind}
   * @default 'normal'
   */
  kind?: TagKind;
}

/**
 * Options of a context, which defines how content is read: which tags are known, and whether self-closing tags, CDATA
 * sections and processing instructions are recognized.
 *
 * @group Tokenizer
 */
export interface TokenizerContextOptions {
  /**
   * The map from a tag name to options of the tag. If several keys differ only in case and
   * {@link TokenizerOptions.areTagNamesCaseInsensitive tag names are case-insensitive}, an error is thrown.
   *
   * **Note:** These tags aren't applied to content of {@link TagParsingOptions.foreignContext foreign tags}, which is
   * read with tags of their own options.
   *
   * @example
   * {
   *   br: { kind: 'void' },
   *   script: { kind: 'raw_text' },
   *   p: {
   *     implicitEndingTagNames: ['div', 'p'],
   *     isImplicitlyStarted: true,
   *   },
   * }
   */
  tags?: Record<string, TagParsingOptions>;

  /**
   * If `true` then self-closing tags (`<br/>`) are recognized, otherwise they are treated as start tags.
   *
   * @default false
   */
  areSelfClosingTagsRecognized?: boolean;

  /**
   * If `true` then CDATA sections (`<![CDATA[…]]>`) are recognized, otherwise they are treated as comments.
   *
   * @default false
   */
  areCDATASectionsRecognized?: boolean;

  /**
   * The syntax that processing instructions are read with.
   *
   * @see {@link ProcessingInstructionSyntax}
   * @default 'comment'
   */
  processingInstructionSyntax?: ProcessingInstructionSyntax;
}

/**
 * Options of {@link createTokenizer}.
 *
 * @group Tokenizer
 */
export interface TokenizerOptions extends TokenizerContextOptions {
  /**
   * If `true` then the case of ASCII letters in tag names is ignored.
   *
   * @default false
   */
  areTagNamesCaseInsensitive?: boolean;

  /**
   * If `true` then tags that aren't ended before the end tag of an enclosing tag, or before the end of the input, are
   * implicitly ended. Otherwise, a {@link MarkupSyntaxError} is thrown.
   *
   * Use in conjunction with {@link areUnbalancedEndTagsIgnored}.
   *
   * ```html
   * <a><b></a>  →  <a><b></b></a>
   *                      ▔▔▔▔ b is implicitly ended
   * ```
   *
   * @default false
   */
  areUnbalancedStartTagsImplicitlyEnded?: boolean;

  /**
   * If `true` then unbalanced end tags are ignored, otherwise a {@link MarkupSyntaxError} is thrown. An end tag is
   * unbalanced if it doesn't match an enclosing tag, or if it can't end the tags inside the matching one, see
   * {@link TagParsingOptions.endTagScopeLevel}.
   *
   * Use in conjunction with {@link areUnbalancedStartTagsImplicitlyEnded}.
   *
   * ```html
   * <a></b></a>  →  <a></a>
   *    ▔▔▔▔ b is ignored
   * ```
   *
   * @default false
   */
  areUnbalancedEndTagsIgnored?: boolean;

  /**
   * If `true` then the input is read with XML constraints, and a {@link MarkupSyntaxError} is thrown if the input
   * doesn't satisfy them:
   *
   * - tag names, attribute names and processing instruction targets must be valid XML names;
   * - attributes must have values in double or single quotes;
   * - comments, CDATA sections and processing instructions must be closed;
   * - a document can't have more than one root element.
   *
   * Otherwise, the tokenizer is forgiving: it reads markup by HTML rules, and throws only if tags can't be balanced.
   *
   * @default false
   */
  isStrict?: boolean;
}

/**
 * Options of {@link createDOMParser} and {@link createSAXParser}.
 *
 * @group Parser
 */
export interface ParserOptions {
  /**
   * The tokenizer that reads tokens for the parser. Parsers that share a tokenizer share its resolved options, so
   * create a tokenizer once and pass it to every parser that reads the same markup.
   *
   * @example
   * import { createDOMParser, HTMLTokenizer } from 'tag-soup';
   *
   * createDOMParser({ tokenizer: HTMLTokenizer });
   *
   * @default createTokenizer()
   */
  tokenizer?: Tokenizer;

  /**
   * Renames tags. Use this method to normalize tag names, for example to lower case in HTML.
   *
   * End tags get the name of the start tag that they end, since the tokenizer matches tags by their names in the
   * input.
   *
   * By default, tags aren't renamed.
   *
   * @example
   * createDOMParser({ renameTag: name => name.toLowerCase() });
   *
   * @param name The tag name as it appears in the input.
   * @returns The tag name that the parser uses.
   */
  renameTag?: (name: string) => string;

  /**
   * Renames attributes. Use this method to normalize attribute names, for example to lower case in HTML.
   *
   * By default, attributes aren't renamed.
   *
   * @example
   * createDOMParser({ renameAttribute: name => name.toLowerCase() });
   *
   * @param name The attribute name as it appears in the input.
   * @returns The attribute name that the parser uses.
   */
  renameAttribute?: (name: string) => string;

  /**
   * Decodes text. Use this method to decode HTML/XML entities.
   *
   * Text of `raw_text` and `script_data` {@link TagParsingOptions.kind tags}, comments, CDATA sections and processing
   * instructions isn't decoded.
   *
   * By default, text isn't decoded.
   *
   * @example
   * import { decodeHTML } from 'speedy-entities';
   *
   * createDOMParser({ decodeText: decodeHTML });
   *
   * @param text The text to decode.
   */
  decodeText?: (text: string) => string;

  /**
   * Decodes attribute values. Use this method to decode HTML/XML entities.
   *
   * It's separate from {@link decodeText} because HTML decodes attribute values differently: `&copy=2` stays intact in
   * an attribute value, but becomes `©=2` in text.
   *
   * By default, attribute values aren't decoded.
   *
   * @example
   * import { decodeHTMLAttribute } from 'speedy-entities';
   *
   * createDOMParser({ decodeAttribute: decodeHTMLAttribute });
   *
   * @param value The attribute value to decode.
   */
  decodeAttribute?: (value: string) => string;

  /**
   * If `true` then `xmlns` and `xmlns:*` attributes declare namespaces, and a tag gets the namespace that the prefix of
   * its name is bound to, or the default namespace if the name has no prefix. Otherwise, tags have no namespace.
   *
   * ```html
   * <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
   *   <xlink:a/>
   * </svg>
   * ```
   *
   * Here `svg` has the namespace `http://www.w3.org/2000/svg`, and `xlink:a` has the namespace
   * `http://www.w3.org/1999/xlink`.
   *
   * A tag can declare the namespace of its own name. A tag whose prefix isn't bound has no namespace. Attributes that
   * declare namespaces are kept, and namespaces of other attributes aren't resolved by parsers. In a DOM,
   * [`Element.getAttributeNS`](https://smikhalevski.github.io/flyweight-dom/classes/flyweight-dom.Element.html#getattributens)
   * looks them up.
   *
   * Namespaces are recognized after tags and attributes are {@link renameTag renamed}, and attribute values are
   * {@link decodeAttribute decoded}.
   *
   * @default false
   */
  areNamespacesRecognized?: boolean;
}

/**
 * Options of {@link createSerializer}.
 *
 * @group Serializer
 */
export interface SerializerOptions {
  /**
   * The map from a tag name to options of the tag.
   *
   * @example
   * {
   *   br: { kind: 'void' },
   *   script: { kind: 'raw_text' },
   * }
   */
  tags?: Record<string, TagSerializationOptions>;

  /**
   * If `true` then the case of ASCII letters in tag names is ignored.
   *
   * @default false
   */
  areTagNamesCaseInsensitive?: boolean;

  /**
   * If `true` then elements without children are written as self-closing tags (`<a/>`), otherwise as a start tag
   * followed by an end tag (`<a></a>`). Void elements without children are always written as a start tag only.
   *
   * @default false
   */
  areSelfClosingTagsSupported?: boolean;

  /**
   * Encodes text. Use this method to encode HTML/XML entities.
   *
   * Text of `raw_text` and `script_data` {@link TagSerializationOptions.kind tags}, comments, CDATA sections and
   * processing instructions is written as is.
   *
   * By default, text isn't encoded.
   *
   * @example
   * import { escapeXML } from 'speedy-entities';
   *
   * createSerializer({ encodeText: escapeXML });
   *
   * @param text The text to encode.
   */
  encodeText?: (text: string) => string;

  /**
   * Encodes attribute values. Use this method to encode HTML/XML entities. Values are written in double quotes, so `"`
   * must be encoded.
   *
   * By default, attribute values aren't encoded.
   *
   * @example
   * import { escapeXML } from 'speedy-entities';
   *
   * createSerializer({ encodeAttribute: escapeXML });
   *
   * @param value The attribute value to encode.
   */
  encodeAttribute?: (value: string) => string;
}

/**
 * Parses an input that is written in chunks.
 *
 * A token that reaches the end of a chunk is read when the next chunk is written, since the token can continue there,
 * so the result is the same as if the whole input was parsed at once. Text between tags, including the content of raw
 * text tags, is read as a single token as well.
 *
 * @template TResult The result of parsing.
 * @see {@link DOMParser.createDocumentWriter}
 * @see {@link SAXParser.createDocumentWriter}
 * @see {@link Tokenizer.createDocumentWriter}
 * @group Parser
 */
export interface ParserWriter<TResult = void> {
  /**
   * Parses a chunk.
   *
   * @param chunk The chunk to parse.
   * @throws {@link MarkupSyntaxError} If the input is malformed and tokenizer options don't allow recovery. Chunks
   * can't be written after that.
   */
  write(chunk: string): void;

  /**
   * Parses the last chunk, and ends tags that weren't ended. Chunks can't be written after that.
   *
   * @param chunk The last chunk.
   * @returns The result of parsing.
   * @throws {@link MarkupSyntaxError} If the input is malformed and tokenizer options don't allow recovery.
   */
  end(chunk?: string): TResult;
}

/**
 * Reads tokens from an input that is written in chunks, and passes them to a {@link TokenHandler}.
 *
 * @see {@link Tokenizer.createDocumentWriter}
 * @see {@link Tokenizer.createFragmentWriter}
 * @group Tokenizer
 */
export interface TokenizerWriter extends ParserWriter {
  /**
   * The index in the stream where the input that is passed to the handler starts. The stream is all chunks that were
   * written, and the input is the last written chunk, preceded by the part of earlier chunks that wasn't read yet.
   *
   * @example
   * const writer = HTMLTokenizer.createDocumentWriter({
   *   onText(input, startIndex, endIndex, isRawText) {
   *     writer.inputOffset + startIndex;
   *     // ⮕ The index in the stream where the token starts
   *   },
   * });
   */
  readonly inputOffset: number;
}

/**
 * Receives tokens that are read from an input, one method per token.
 *
 * @group Tokenizer
 */
export interface TokenHandler {
  /**
   * Called when text between tags is read.
   *
   * @param input The input that indexes point to.
   * @param startIndex The start index of the text, inclusive.
   * @param endIndex The end index of the text, exclusive.
   * @param isRawText `true` if the text is the content of a `raw_text` or `script_data`
   * {@link TagParsingOptions.kind tag}, so parsers don't decode it.
   */
  onText?(input: string, startIndex: number, endIndex: number, isRawText: boolean): void;

  /**
   * Called when the tag name in a start tag is read, `p` in `<p>`.
   *
   * @param input The input that indexes point to.
   * @param startIndex The start index of the tag name, inclusive.
   * @param endIndex The end index of the tag name, exclusive.
   */
  onStartTagName?(input: string, startIndex: number, endIndex: number): void;

  /**
   * Called when the `>` that closes a start tag is read. Also called when the input ends inside a start tag, and for a
   * start tag that a tokenizer inserts, with indexes that don't point to `>`.
   *
   * @param input The input that indexes point to.
   * @param startIndex The start index of the closing, inclusive.
   * @param endIndex The end index of the closing, exclusive.
   */
  onStartTagClosing?(input: string, startIndex: number, endIndex: number): void;

  /**
   * Called when the `/>` that closes a self-closing tag is read.
   *
   * Only called if {@link TokenizerContextOptions.areSelfClosingTagsRecognized self-closing tags are recognized}.
   *
   * @param input The input that indexes point to.
   * @param startIndex The start index of the closing, inclusive.
   * @param endIndex The end index of the closing, exclusive.
   */
  onStartTagSelfClosing?(input: string, startIndex: number, endIndex: number): void;

  /**
   * Called when the tag name in an end tag is read, `p` in `</p>`.
   *
   * End tags that a tokenizer inserts, for void tags and implicitly ended tags, have equal start and end indexes.
   *
   * @param input The input that indexes point to.
   * @param startIndex The start index of the tag name, inclusive.
   * @param endIndex The end index of the tag name, exclusive.
   */
  onEndTagName?(input: string, startIndex: number, endIndex: number): void;

  /**
   * Called when an attribute is read. Value indexes point to the value without quotes, and are equal if the attribute
   * has no value.
   *
   * @param input The input that indexes point to.
   * @param nameStartIndex The start index of the attribute name, inclusive.
   * @param nameEndIndex The end index of the attribute name, exclusive.
   * @param valueStartIndex The start index of the attribute value, inclusive.
   * @param valueEndIndex The end index of the attribute value, exclusive.
   */
  onAttribute?(
    input: string,
    nameStartIndex: number,
    nameEndIndex: number,
    valueStartIndex: number,
    valueEndIndex: number
  ): void;

  /**
   * Called when a comment is read. Indexes point to the comment content between `<!--` and `-->`.
   *
   * A forgiving tokenizer reads unrecognized markup like `<!x>`, `<?x>` and `</#>` as a bogus comment, with the
   * content `x`, `?x` and `#`.
   *
   * @param input The input that indexes point to.
   * @param startIndex The start index of the comment content, inclusive.
   * @param endIndex The end index of the comment content, exclusive.
   * @see [HTML Bogus Comment State](https://html.spec.whatwg.org/multipage/parsing.html#bogus-comment-state)
   */
  onComment?(input: string, startIndex: number, endIndex: number): void;

  /**
   * Called when a processing instruction is read: in `<?xml version="1.0"?>` the target is `xml` and the data is
   * `version="1.0"`.
   *
   * @param input The input that indexes point to.
   * @param targetStartIndex The start index of the target, inclusive.
   * @param targetEndIndex The end index of the target, exclusive.
   * @param dataStartIndex The start index of the data, inclusive.
   * @param dataEndIndex The end index of the data, exclusive.
   */
  onProcessingInstruction?(
    input: string,
    targetStartIndex: number,
    targetEndIndex: number,
    dataStartIndex: number,
    dataEndIndex: number
  ): void;

  /**
   * Called when a CDATA section is read. Indexes point to the content between `<![CDATA[` and `]]>`.
   *
   * @param input The input that indexes point to.
   * @param startIndex The start index of the content, inclusive.
   * @param endIndex The end index of the content, exclusive.
   */
  onCDATASection?(input: string, startIndex: number, endIndex: number): void;

  /**
   * Called when a DOCTYPE is read.
   *
   * A missing identifier has equal start and end indexes, so in `<!DOCTYPE html>` both identifiers are empty strings.
   *
   * DOCTYPE is read only in a document, before the first tag or text. A forgiving tokenizer reads the first DOCTYPE
   * there and ignores the others, and a strict tokenizer throws a {@link MarkupSyntaxError} at DOCTYPE elsewhere.
   *
   * @param input The input that indexes point to.
   * @param nameStartIndex The start index of the name, inclusive.
   * @param nameEndIndex The end index of the name, exclusive.
   * @param publicIdStartIndex The start index of the public identifier, inclusive.
   * @param publicIdEndIndex The end index of the public identifier, exclusive.
   * @param systemIdStartIndex The start index of the system identifier, inclusive.
   * @param systemIdEndIndex The end index of the system identifier, exclusive.
   */
  onDoctype?(
    input: string,
    nameStartIndex: number,
    nameEndIndex: number,
    publicIdStartIndex: number,
    publicIdEndIndex: number,
    systemIdStartIndex: number,
    systemIdEndIndex: number
  ): void;
}
