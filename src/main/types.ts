/**
 * The kind of a tag, which defines what the tag can contain, and how parsers read it and serializers write it:
 *
 * - `'normal'`: tag can contain tags and text. Parsers decode this text {@link ParserOptions.decodeText}, and
 * serializers encode it with {@link SerializerOptions.encodeText}.
 * - `'void'`: tag can contain nothing. Parsers insert an end tag right after the start tag, and serializers write the
 * tag without an end tag and ignore its children.
 * - `'raw_text'`: tag can contain text up to the matching end tag. Parsers don't decode this text, and serializers
 * write it as is.
 * - `'escapable_raw_text'`: same as `'raw_text'`, but parsers decode the text, and serializers encode it.
 * - `'script_data'`: same as `'raw_text'`, but after `<!--` a start tag of the same name hides end tags until its own
 * end tag or `-->`. Browsers read `script` this way for compatibility with old scripts wrapped in comments:
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
   * Options that are applied to attributes and content of the tag, which makes it a foreign tag. Outer options are
   * restored when the tag is ended. Foreign options don't inherit outer options, but options can reference each
   * other, so foreign content may contain tags that switch back to outer options.
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
   * { p: { implicitlyEndedBy: ['h1'] } }
   * ```
   *
   * Use in conjunction with {@link TokenizerOptions.areUnbalancedStartTagsImplicitlyEnded} and
   * {@link isImplicitEndingBoundary}.
   *
   * Tags are ended by name in any context. A tag inside a {@link foreignContext foreign tag} can end the foreign tag,
   * and then it's read with tags of the outer options. For example, in HTML `svg` is implicitly ended by `br`:
   *
   * ```html
   * <svg><br>text  →  <svg></svg><br/>text
   *                        ▔▔▔▔▔▔ svg is implicitly ended by br
   * ```
   *
   * To achieve this behavior, set {@link TokenizerContextOptions.tags tags} to:
   *
   * ```ts
   * {
   *   svg: {
   *     implicitlyEndedBy: ['br'],
   *     foreignContext: {},
   *   },
   *   br: { kind: 'void' },
   * }
   * ```
   */
  implicitlyEndedBy?: string[];

  /**
   * If `true` then the tag is a boundary for {@link implicitlyEndedBy implicit ending}: tags that are started inside
   * this tag don't implicitly end tags outside of it. A boundary tag that must be implicitly ended itself doesn't limit
   * anything.
   *
   * For example, in HTML `li` is implicitly ended by `li`, but only inside the nearest list:
   *
   * ```html
   * <ul><li><ul><li>  →  <ul><li><ul><li></li></ul></li></ul>
   *                                  ▔▔▔▔ outer li isn't ended by the nested li
   * ```
   *
   * To achieve this behavior, set {@link TokenizerContextOptions.tags tags} to:
   *
   * ```ts
   * {
   *   li: { implicitlyEndedBy: ['li'] },
   *   ul: { isImplicitEndingBoundary: true },
   *   ol: { isImplicitEndingBoundary: true },
   * }
   * ```
   *
   * @default false
   */
  isImplicitEndingBoundary?: boolean;

  /**
   * If `true` then a start tag is inserted if an unbalanced end tag of this tag is met. Otherwise,
   * a {@link MarkupSyntaxError} is thrown.
   *
   * You can ignore unbalanced end tags with {@link TokenizerOptions.areUnbalancedEndTagsIgnored}.
   *
   * For example, in HTML `p` and `br` tags follow these semantics:
   *
   * ```html
   * </p>   →  <p></p>
   *           ▔▔▔ p is implicitly started
   *
   * </br>  →  <br/>
   *           ▔▔▔▔▔ br is implicitly started and self-closed
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
   * @default false
   */
  isImplicitlyStarted?: boolean;
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
   * The map from a tag name to options of the tag.
   *
   * **Note:** These tags aren't applied to content of {@link TagParsingOptions.foreignContext foreign tags}, which is
   * read with tags of their own options.
   *
   * @example
   * {
   *   br: { kind: 'void' },
   *   script: { kind: 'raw_text' },
   *   p: {
   *     implicitlyEndedBy: ['div', 'p'],
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
   * If `true` then processing instructions (`<?target data?>`) are recognized, otherwise they are treated as comments.
   *
   * @default false
   */
  areProcessingInstructionsRecognized?: boolean;
}

/**
 * Options of {@link createTokenizer}.
 *
 * @group Tokenizer
 */
export interface TokenizerOptions extends TokenizerContextOptions {
  /**
   * If `true` then ASCII alpha characters are case-insensitive in tag names.
   *
   * @default false
   */
  areTagNamesCaseInsensitive?: boolean;

  /**
   * If `true` then tags that aren't ended before the end tag of an ancestor, or before the end of the input, are
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
   * If `true` then end tags that don't have a corresponding start tag are ignored. Otherwise,
   * a {@link MarkupSyntaxError} is thrown.
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
   * If `true` then input is read with XML constraints, and a {@link MarkupSyntaxError} is thrown if input doesn't
   * satisfy them:
   *
   * - tag names, attribute names and processing instruction targets must be valid XML names;
   * - attributes must have values in double or single quotes;
   * - comments, CDATA sections and processing instructions must be terminated;
   * - a document must have a single root element.
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
export interface ParserOptions extends TokenizerOptions {
  /**
   * Decodes text content. Use this method to decode HTML/XML entities.
   *
   * Text inside {@link TagParsingOptions.kind raw text tags}, comments, CDATA sections and processing instructions
   * isn't decoded.
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
}

/**
 * A value in the output of a {@link JSONParser}. Markup has no numbers, booleans or `null`, so the output consists of
 * strings, arrays and objects only.
 *
 * @group JSON
 */
export type JSONValue = string | JSONValue[] | { [key: string]: JSONValue };

/**
 * Options of {@link createJSONParser}.
 *
 * Without these options the output keeps all elements, attributes and text in the order they are written. Each option
 * makes the output simpler and gives up a part of this information. Options never make the type of a value depend on
 * the parsed markup: if markup doesn't fit options, a {@link MarkupSyntaxError} is thrown.
 *
 * @group JSON
 */
export interface JSONParserOptions extends ParserOptions {
  /**
   * How the content of an element is stored in its object:
   *
   * - `'ordered'`: the `$` key holds an array of text and child elements in the order they are written. Text between
   * child elements is a string, and a child element is an object with a single key, the name of the element. Nothing
   * is lost, so this layout fits markup with mixed content, like HTML.
   *
   * - `'grouped'`: the `$` key holds all text of the element as a single string, and child elements are stored in
   * arrays under their names. An array is used even if there's a single child element with this name, see
   * {@link singleElements}. Paths to values are short, but the order of child elements with different names is lost,
   * and so are positions of text among child elements. This layout fits markup that holds data, like feeds and API
   * responses.
   *
   * ```ts
   * // <aaa xxx="yyy">bbb<ccc></ccc>ddd</aaa>
   *
   * // 'ordered'
   * { aaa: { $xxx: 'yyy', $: ['bbb', { ccc: { $: [] } }, 'ddd'] } }
   *
   * // 'grouped'
   * { aaa: { $xxx: 'yyy', $: 'bbbddd', ccc: [{ $: '' }] } }
   * ```
   *
   * @default 'ordered'
   */
  layout?: 'ordered' | 'grouped';

  /**
   * What whitespace is removed from text:
   *
   * - `'preserve'`: none. Indentation of markup is text, so it is a part of the output.
   * - `'drop_blank'`: whitespace of text that consists only of whitespace. Other text is kept as is.
   * - `'trim'`: whitespace at the start and at the end of text.
   *
   * Whitespace is a space, a tab, a line feed and a carriage return. Other chars are text, even a no-break space.
   *
   * The option is applied to each string of the output that holds text: an item of the `$` array in the `'ordered'`
   * {@link layout}, the `$` string in the `'grouped'` layout, and the value of a {@link textElements text element}.
   * The option is applied to the whole string, so whitespace is kept between parts of text that child elements
   * separate. A string that becomes empty isn't added to the `$` array.
   *
   * Attribute values are never changed.
   *
   * The text of an element is kept as is if the element preserves whitespace: among `xml:space` attributes of the
   * element and its ancestors that are either `preserve` or `default`, the nearest one is `preserve`.
   *
   * @default 'preserve'
   */
  whitespace?: 'preserve' | 'drop_blank' | 'trim';

  /**
   * What to do with the `$` key of an object if the content of its element is empty:
   *
   * - `'keep'`: the key holds `[]` in the `'ordered'` {@link layout}, or `''` in the `'grouped'` layout, so every
   * object of an element has this key.
   * - `'omit'`: the key is absent. Nothing is lost, since an absent key means the empty content.
   *
   * @default 'keep'
   */
  emptyContent?: 'keep' | 'omit';

  /**
   * What a document is converted to:
   *
   * - `'wrap'`: an object with a single key, the name of the root element, that holds the value of the root element.
   * - `'unwrap'`: the value of the root element, so its name is lost.
   *
   * A fragment has no root element, so the option isn't applied to it.
   *
   * @default 'wrap'
   */
  root?: 'wrap' | 'unwrap';

  /**
   * The map from a prefix to a namespace URI, which makes names in the output independent of prefixes that markup
   * uses.
   *
   * By default, names of elements and attributes are kept as written, like `atom:link`, and namespace declarations
   * (`xmlns` and `xmlns:*`) are attributes.
   *
   * If the map is provided, names are resolved with namespace declarations that are in scope. A tag name without
   * a prefix is in the default namespace if it is declared, and an attribute name without a prefix is in no
   * namespace. A name in a namespace that is mapped to a prefix becomes the prefix, `$` and the local part of the
   * name, like `atom$link`, or only the local part if the prefix is `''`. A name that is in no namespace is kept as
   * is. Namespace declarations aren't a part of the output.
   *
   * A prefix is an XML name without a colon, or `''`. A namespace URI can't be mapped to several prefixes. The `xml`
   * prefix can be mapped only to `http://www.w3.org/XML/1998/namespace`, and it is mapped to it by default, unless
   * this URI is mapped to another prefix.
   *
   * A {@link MarkupSyntaxError} is thrown if a name is in a namespace that isn't mapped, has a prefix that isn't
   * declared, or isn't a qualified name. It's also thrown if two attributes of an element have the same name in the
   * output, and if two child elements of an element have the same name in the output but different namespaces.
   *
   * @example
   * {
   *   '': 'http://www.w3.org/2005/Atom',
   *   dc: 'http://purl.org/dc/elements/1.1/',
   * }
   */
  namespaces?: Readonly<Record<string, string>>;

  /**
   * Elements that are converted to strings, since their text is all that matters, like `title`.
   *
   * The string is the text of the element and of all its descendants. Attributes of the element are lost, and so is
   * the markup inside it, so their names aren't {@link namespaces resolved}.
   *
   * An entry is either a name of an element, or names of its parent and of the element separated by a slash, like
   * `item/title`. Entries are names that elements have in the output, so with {@link namespaces} an entry looks like
   * `dc$creator`.
   *
   * @default []
   */
  textElements?: readonly string[];

  /**
   * Elements that occur at most once in their parent, so in the `'grouped'` {@link layout} they are stored under their
   * names as is, rather than in arrays. A {@link MarkupSyntaxError} is thrown if such element occurs twice in its
   * parent.
   *
   * The option has no effect in the `'ordered'` layout.
   *
   * Entries have the same format as entries of {@link textElements}.
   *
   * @default []
   */
  singleElements?: readonly string[];

  /**
   * Elements that only hold a list of elements with the same name, like `tags` that holds `tag` elements. They are
   * converted to arrays of values of their child elements, so the name of child elements is lost.
   *
   * A {@link MarkupSyntaxError} is thrown if such element has attributes other than namespace declarations, text other
   * than whitespace, or child elements with different names.
   *
   * In the `'grouped'` {@link layout} such elements are {@link singleElements single elements}: they are stored under
   * their names as is, and can't occur twice in their parent.
   *
   * Entries have the same format as entries of {@link textElements}. An element can't be both in this list and in
   * {@link textElements}.
   *
   * @default []
   */
  listElements?: readonly string[];
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
   * If `true` then ASCII alpha characters are case-insensitive in tag names.
   *
   * @default false
   */
  areTagNamesCaseInsensitive?: boolean;

  /**
   * If `true` then elements without children are written as self-closing tags (`<a/>`), otherwise as a start tag
   * followed by an end tag (`<a></a>`). Void tags are always written without an end tag.
   *
   * @default false
   */
  areSelfClosingTagsSupported?: boolean;

  /**
   * Encodes text content. Use this method to encode HTML/XML entities.
   *
   * Text inside {@link TagSerializationOptions.kind raw text tags}, comments, CDATA sections and processing
   * instructions is written as is.
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
 * Parses text that is written in chunks.
 *
 * A token that reaches the end of a chunk is read when the next chunk is written, since the token can continue there,
 * so the result is the same as if the whole text was parsed at once. Text between tags, including the content of raw
 * text tags, is read as a single token as well.
 *
 * @template TResult The result of parsing.
 * @see {@link DOMParser.createDocumentWriter}
 * @see {@link SAXParser.createDocumentWriter}
 * @see {@link JSONParser.createDocumentWriter}
 * @see {@link Tokenizer.createDocumentWriter}
 * @group Parser
 */
export interface ParserWriter<TResult = void> {
  /**
   * Parses a chunk of text.
   *
   * @param chunk The chunk of text.
   * @throws {@link MarkupSyntaxError} If text is malformed and options don't allow to recover.
   */
  write(chunk: string): void;

  /**
   * Parses the last chunk of text, and ends tags that weren't ended. Chunks can't be written after that.
   *
   * @param chunk The last chunk of text.
   * @returns The result of parsing.
   * @throws {@link MarkupSyntaxError} If text is malformed and options don't allow to recover.
   */
  end(chunk?: string): TResult;
}

/**
 * Reads tokens from text that is written in chunks, and returns them by invoking a callback.
 *
 * @see {@link Tokenizer.createDocumentWriter}
 * @see {@link Tokenizer.createFragmentWriter}
 * @group Tokenizer
 */
export interface TokenizerWriter extends ParserWriter {
  /**
   * The index in the stream where the input that is passed to the callback starts. The stream is all chunks that were
   * written, and the input is the part of the stream that wasn't read before, followed by the last written chunk.
   *
   * @example
   * const writer = HTMLTokenizer.createDocumentWriter((tokenKind, startIndex, endIndex, input) => {
   *   writer.inputOffset + startIndex;
   *   // ⮕ The index in the stream where the token starts
   * });
   */
  readonly inputOffset: number;
}

/**
 * The kind of a token that can be read from text. Indices passed to {@link TokenCallback} with the kind point to:
 *
 * - `text`: text between tags.
 * - `start_tag_name`: the tag name in a start tag, `p` in `<p>`.
 * - `start_tag_closing`: the `>` that closes a start tag.
 * - `start_tag_self_closing`: the `/>` that closes a self-closing tag.
 * - `end_tag_name`: the tag name in an end tag, `p` in `</p>`.
 * - `attribute_name`: an attribute name.
 * - `attribute_value`: an attribute value without quotes. Entities aren't decoded.
 * - `comment`: comment content between `<!--` and `-->`.
 * - `processing_instruction_target`: the target of a processing instruction, `xml` in `<?xml version="1.0"?>`.
 * - `processing_instruction_data`: the data of a processing instruction, `version="1.0"` in `<?xml version="1.0"?>`.
 * - `cdata_section`: CDATA section content between `<![CDATA[` and `]]>`.
 * - `doctype_name`: the name in a DOCTYPE declaration, `html` in `<!DOCTYPE html>`.
 *
 * End tags that are inserted by a tokenizer, for void tags and implicitly ended tags, have equal start and end
 * indices.
 *
 * @group Tokenizer
 */
export type TokenKind =
  | 'text'
  | 'start_tag_name'
  | 'start_tag_closing'
  | 'start_tag_self_closing'
  | 'end_tag_name'
  | 'attribute_name'
  | 'attribute_value'
  | 'comment'
  | 'processing_instruction_target'
  | 'processing_instruction_data'
  | 'cdata_section'
  | 'doctype_name';

/**
 * A callback that is invoked when a token is read from text.
 *
 * @param tokenKind The kind of the token that was read.
 * @param startIndex The start index of the first meaningful token char in the input, inclusive.
 * @param endIndex The end index of the last meaningful token char in the input, exclusive.
 * @param input The text that indices point to. A writer passes the part of the stream that it didn't read before,
 * followed by the last written chunk, and this text starts at {@link TokenizerWriter.inputOffset} in the stream.
 * @group Tokenizer
 */
export type TokenCallback = (tokenKind: TokenKind, startIndex: number, endIndex: number, input: string) => void;
