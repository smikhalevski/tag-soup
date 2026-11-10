import { MarkupSyntaxError } from './MarkupSyntaxError.ts';
import {
  type JSONParserConfig,
  NAME_LIST_LIST,
  NAME_LIST_SINGLE,
  NAME_LIST_TEXT,
  resolveJSONParserOptions,
  XML_NAMESPACE_URI,
} from './resolveJSONParserOptions.ts';
import { createTokenizerState, createTokenizerWriter, isSpaceChar } from './tokenizeMarkup.ts';
import type { JSONParserOptions, JSONValue, ParserWriter, TokenCallback } from './types.ts';
import { areCaseInsensitiveSubstringsEqual, areCaseSensitiveSubstringsEqual, toASCIILowerCase } from './utils.ts';

/**
 * Parses text as JSON.
 *
 * @see {@link createJSONParser}
 * @group JSON
 */
export interface JSONParser {
  /**
   * Parses text as a document.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text. A document must have a single
   * root element, and text outside of it isn't a part of the output.
   *
   * @param input The text to parse.
   * @returns The object with a single key, the name of the root element, that holds the value of the root element. If
   * {@link JSONParserOptions.root} is `'unwrap'` then the value of the root element is returned.
   * @throws {@link MarkupSyntaxError} If input is malformed and parser options don't allow to recover, if input
   * doesn't fit {@link JSONParserOptions parser options}, or if input doesn't have a single root element.
   */
  parseDocument(input: string): JSONValue;

  /**
   * Parses text as a document fragment, which is the content of an element that has no name and no attributes.
   *
   * DOCTYPE isn't recognized.
   *
   * @param input The text to parse.
   * @returns The object of the element that has the input as its content.
   * @throws {@link MarkupSyntaxError} If input is malformed and parser options don't allow to recover, or if input
   * doesn't fit {@link JSONParserOptions parser options}.
   */
  parseFragment(input: string): Record<string, JSONValue>;

  /**
   * Creates a writer that parses a document written in chunks.
   *
   * Leading spaces are skipped, and DOCTYPE is recognized before the first tag or text. A document must have a single
   * root element, and text outside of it isn't a part of the output.
   *
   * @example
   * const writer = jsonParser.createDocumentWriter();
   *
   * writer.write('<aaa>Hello, ');
   * writer.write('Bob!');
   *
   * writer.end('</aaa>');
   * // ⮕ { aaa: { $: ['Hello, Bob!'] } }
   *
   * @returns The new writer.
   */
  createDocumentWriter(): ParserWriter<JSONValue>;

  /**
   * Creates a writer that parses a document fragment written in chunks.
   *
   * DOCTYPE isn't recognized.
   *
   * @returns The new writer.
   */
  createFragmentWriter(): ParserWriter<Record<string, JSONValue>>;
}

/**
 * Creates a parser that parses text as JSON.
 *
 * By default, the output keeps all elements, attributes and text in the order they are written:
 *
 * - An element is converted to an object. Each attribute is stored under the key that is `$` followed by the name of
 * the attribute, and the content of the element is stored under the `$` key. Tag names can't start with `$`, so keys
 * are always distinct.
 *
 * - The content is an array of text and child elements. Text between elements is a single string, even if comments,
 * processing instructions or CDATA sections split it. A child element is an object with a single key, the tag name,
 * that holds the object of the child element.
 *
 * - Values are strings, nothing is converted to numbers or booleans.
 *
 * - Comments, processing instructions and DOCTYPE aren't a part of the output.
 *
 * {@link JSONParserOptions Options} make the output simpler, see {@link JSONParserOptions.layout} first.
 *
 * Text and attribute values are the same as other parsers read: they are decoded with
 * {@link ParserOptions.decodeText} and {@link ParserOptions.decodeAttribute}. If
 * {@link TokenizerOptions.areTagNamesCaseInsensitive tag names are case-insensitive}, they are converted to ASCII
 * lower case, so the output doesn't depend on the case of tag names. Attribute names are kept as written. If
 * a start tag has several attributes with the same name, a {@link MarkupSyntaxError} is thrown if the parser is
 * {@link TokenizerOptions.isStrict strict} or resolves {@link JSONParserOptions.namespaces namespaces}, otherwise the
 * value of the last attribute is used.
 *
 * @example
 * import { createJSONParser } from 'tag-soup';
 *
 * const parser = createJSONParser();
 *
 * parser.parseDocument('<aaa xxx="yyy">bbb<ccc></ccc></aaa>');
 * // ⮕ { aaa: { $xxx: 'yyy', $: ['bbb', { ccc: { $: [] } }] } }
 *
 * @param options Parser options.
 * @returns The new JSON parser.
 * @throws Error If options are invalid.
 * @group JSON
 */
export function createJSONParser(options: JSONParserOptions = {}): JSONParser {
  const documentConfig: JSONParserConfig = resolveJSONParserOptions(options);

  const fragmentConfig: JSONParserConfig = { ...documentConfig, isFragment: true };

  return {
    parseDocument(input) {
      return createJSONParserWriter(documentConfig).end(input);
    },

    parseFragment(input) {
      return createJSONParserWriter(fragmentConfig).end(input) as Record<string, JSONValue>;
    },

    createDocumentWriter() {
      return createJSONParserWriter(documentConfig);
    },

    createFragmentWriter() {
      return createJSONParserWriter(fragmentConfig) as ParserWriter<Record<string, JSONValue>>;
    },
  };
}

/**
 * A name of a tag that was read from the input. Tags with the same name share an entry, so the name is copied from the
 * input and resolved to an element once.
 */
interface TagEntry {
  /**
   * The name of the tag, in lower case if tag names are case-insensitive.
   */
  tagName: string;

  /**
   * The next entry of a tag whose name has the same hash code.
   */
  next: TagEntry | undefined;

  /**
   * The namespace prefix of the tag name, or an empty string if there's no prefix or names aren't resolved.
   */
  prefix: string;

  /**
   * The tag name without the namespace prefix.
   */
  localName: string;

  /**
   * The namespace URI that the {@link prefix} was bound to when {@link elementInfo} was resolved, or `undefined` if it
   * wasn't resolved yet. The prefix is usually bound to the same namespace in the whole document, so the tag name is
   * resolved once.
   */
  namespaceURI: string | undefined;

  /**
   * The info of the element that the tag starts. If names are resolved, it's the info of the element in
   * {@link namespaceURI the namespace}.
   */
  elementInfo: ElementInfo | undefined;

  /**
   * Names of attributes of the tag that was read last, by the index of an attribute. Tags with the same name usually
   * have the same attributes in the same order, so an attribute name is copied from the input and converted to a key
   * once.
   */
  attributeNames: string[];

  /**
   * Keys of attributes with {@link attributeNames names}. A key is empty if names are resolved, and the attribute
   * either has a namespace prefix, or declares a namespace.
   */
  attributeKeys: string[];
}

/**
 * What is known about elements by their output name.
 */
interface ElementInfo {
  /**
   * The output name of the element, which is a key in the output.
   */
  name: string;

  /**
   * Bits of name lists that have the {@link name} as an entry.
   *
   * @see {@link JSONParserConfig.nameListBitsMap}
   */
  nameListBits: number;

  /**
   * `true` if name lists have entries with the {@link name} and a parent name, so they must be looked up when the
   * parent is known.
   */
  isParentDependent: boolean;

  /**
   * The info of the element that has the same output name but is in a different namespace. Elements that are in no
   * namespace, and elements that are in the namespace mapped to the `''` prefix can have the same output name.
   */
  twin: ElementInfo | undefined;

  /**
   * Values of parents where the element was started last, by the depth of the parent, or `undefined` if
   * {@link JSONParserConfig.canNamesCollide names can't collide}. Parents of the same depth are never enclosing at
   * the same time, so if the {@link twin} has the value of the current parent at its depth, then the twin is
   * a sibling, and child elements from different namespaces have the same output name.
   */
  parentValues: unknown[] | undefined;

  /**
   * The object of the parent where the element was ended last, in the grouped layout. Elements with the same name are
   * usually siblings, so the array that holds their values isn't looked up in the object of the parent again.
   */
  lastParentValue: unknown;

  /**
   * The array that holds values of elements with this {@link name} in {@link lastParentValue}.
   */
  lastValues: unknown[] | undefined;
}

/**
 * Namespace declarations that are in scope of the tag that is being read. Exists only if
 * {@link JSONParserOptions.namespaces names are resolved}.
 */
interface NamespaceScope {
  /**
   * Prefixes that namespace declarations bind, the innermost declaration is the last. An empty prefix is the prefix of
   * the default namespace.
   */
  prefixes: string[];

  /**
   * Namespace URIs that {@link prefixes} are bound to.
   */
  namespaceURIs: string[];

  /**
   * The number of namespace declarations that are in scope.
   */
  declarationCount: number;

  /**
   * Infos of elements by their output name. Tags with different names can start elements with the same output name,
   * and these elements share an info.
   */
  elementInfoMap: Map<string, ElementInfo>;
}

// Kinds of enclosing elements, which are low bits of their flags
const KIND_MASK = 3;

// An element that is converted to an object
const KIND_OBJECT = 0;

// An element that is converted to a string, see JSONParserOptions.textElements
const KIND_TEXT = 1;

// An element that is converted to an array, see JSONParserOptions.listElements
const KIND_LIST = 2;

// A document, which isn't an element, but encloses the root element
const KIND_DOCUMENT = 3;

// The element is stored under its name as is, rather than in an array, see JSONParserOptions.singleElements
const FLAG_SINGLE = 4;

// Whitespace in the text of the element is preserved by an xml:space attribute
const FLAG_SPACE_PRESERVED = 8;

// The object of the element has keys of child elements
const FLAG_CHILD_KEYS = 16;

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Creates a writer that parses chunks of text as JSON.
 *
 * The value of an element is created when its start tag is closed, since namespace declarations of a tag can follow
 * names that they are applied to. The value is added to the value of the parent when the element is ended, so the
 * value can be replaced until then.
 *
 * @param config The parser config.
 * @returns The writer that returns the output of a document, or the object of the element that has a fragment as its
 * content if {@link JSONParserConfig.isFragment} is `true`.
 * @see {@link createTokenizerWriter}
 * @internal
 */
export function createJSONParserWriter(config: JSONParserConfig): ParserWriter<JSONValue> {
  const {
    isFragment,
    areTagNamesCaseInsensitive,
    decodeText,
    decodeAttribute,
    isGrouped,
    isTextTrimmed,
    isEmptyContentOmitted,
    isRootUnwrapped,
    namespacePrefixMap,
    canNamesCollide,
    nameListBitsMap,
  } = config;

  const areTagNamesEqual = areTagNamesCaseInsensitive
    ? areCaseInsensitiveSubstringsEqual
    : areCaseSensitiveSubstringsEqual;

  // Whitespace is preserved by default, so xml:space attributes aren't looked for
  const isSpaceRemoved = isTextTrimmed || config.isBlankTextDropped;

  // Forgiving parsers use the value of the last attribute among attributes with the same key
  const areAttributeKeysUnique = config.isStrict || namespacePrefixMap !== undefined;

  const tokenizerState = createTokenizerState(config.initialContext);

  const namespaceScope: NamespaceScope | undefined =
    namespacePrefixMap !== undefined
      ? { prefixes: [], namespaceURIs: [], declarationCount: 0, elementInfoMap: new Map() }
      : undefined;

  // Entries of tags by the hash code of their name. Different names can have equal hash codes, so entries with the same
  // hash code are linked.
  const tagEntryMap = new Map<number, TagEntry>();

  // Stacks of enclosing elements, the innermost one is the last. The first item isn't an element: it's the document,
  // or the content of the fragment, which is handled as an element without a name and attributes.

  // Infos of enclosing elements
  const elementInfoStack = [createElementInfo('', config)];

  // Objects of enclosing elements, arrays of list elements, and undefined for text elements and the document
  const valueStack: any[] = [isFragment ? {} : undefined];

  // Arrays that are the content of objects in the ordered layout, or undefined if an object has no content yet
  const contentStack: any[] = [undefined];

  // Kinds and flags of enclosing elements
  const flagsStack = [isFragment ? KIND_OBJECT : KIND_DOCUMENT];

  // Text of enclosing elements that was read before their child that is being read
  const textStack = [''];

  // Output names of child elements of enclosing list elements, or undefined if a list element has no children yet
  const listItemNameStack: Array<string | undefined> = [undefined];

  // The number of namespace declarations that were in scope when each enclosing element was started
  const declarationCountStack = [0];

  // The index of the innermost enclosing element in stacks
  let cursor = 0;

  // Text of the innermost enclosing element that isn't a part of its value yet: text after the last child element in
  // the ordered layout, or all text of the element otherwise
  let text = '';

  // The number of start tags inside the innermost text element that aren't ended yet, these tags are ignored
  let ignoredTagCount = 0;

  let isRawText = false;

  // The start tag that is being read
  let tagEntry: TagEntry;
  let attributeNameStartIndex = 0;
  let attributeNameEndIndex = 0;
  let attributeCount = 0;

  // Values of attributes of the start tag that is being read, their names are in the entry of the tag
  const attributeValues: string[] = [];

  // The output of the document, or undefined if the root element isn't ended yet
  let result: JSONValue | undefined;

  // The length of chunks that were written before the last one
  let writtenLength = 0;

  // The content key follows attribute keys, and the content of a fragment has no attributes
  if (isFragment && isGrouped && !isEmptyContentOmitted) {
    valueStack[0].$ = '';
  }

  // Returns the value of the innermost enclosing element when all its content is read
  function getElementValue(): any {
    const flags = flagsStack[cursor];
    const kind = flags & KIND_MASK;
    const value = valueStack[cursor];

    if (kind === KIND_LIST) {
      return value;
    }

    const textValue =
      isSpaceRemoved && text !== '' && (flags & FLAG_SPACE_PRESERVED) === 0 ? removeSpaces(text, isTextTrimmed) : text;

    if (kind === KIND_TEXT) {
      return textValue;
    }

    if (!isGrouped) {
      // Text after the last child element is the last item of the content
      if (textValue !== '') {
        pushContentItem(valueStack, contentStack, cursor, textValue);
      } else if (!isEmptyContentOmitted && contentStack[cursor] === undefined) {
        value.$ = [];
      }
      return value;
    }

    // The content key of an element without text is either omitted, or was added when the element was started
    if (textValue === '') {
      return value;
    }

    // The content key precedes keys of child elements, but it's omitted until there's text, and text can follow child
    // elements
    if (isEmptyContentOmitted && (flags & FLAG_CHILD_KEYS) !== 0) {
      return insertContentKey(value, textValue);
    }

    value.$ = textValue;
    return value;
  }

  // Starts the element of the start tag that is being read. Indices point to the closing of the tag.
  function startElement(input: string, startIndex: number, endIndex: number): void {
    const parentFlags = flagsStack[cursor];
    const parentKind = parentFlags & KIND_MASK;
    const parentValue = valueStack[cursor];
    const attributeNames = tagEntry.attributeNames;
    const attributeKeys = tagEntry.attributeKeys;

    let outerDeclarationCount = 0;
    let elementInfo;

    if (namespaceScope === undefined) {
      elementInfo = tagEntry.elementInfo!;
    } else {
      outerDeclarationCount = namespaceScope.declarationCount;

      // Namespace declarations are applied to the name of their tag and to names of its attributes
      for (let i = 0; i < attributeCount; ++i) {
        const attributeName = attributeNames[i];

        if (attributeKeys[i] === '' && isNamespaceDeclaration(attributeName)) {
          // The prefix is empty if the default namespace is declared
          namespaceScope.prefixes[namespaceScope.declarationCount] = attributeName.substring(6);
          namespaceScope.namespaceURIs[namespaceScope.declarationCount++] = attributeValues[i];
        }
      }

      elementInfo = resolveElementInfo(namespaceScope, config, tagEntry, input, startIndex, endIndex);
    }

    const name = elementInfo.name;

    let nameListBits = elementInfo.nameListBits;

    if (elementInfo.isParentDependent) {
      nameListBits |= nameListBitsMap.get(elementInfoStack[cursor].name + '/' + name) ?? 0;
    }

    let kind = KIND_OBJECT;

    if ((nameListBits & NAME_LIST_TEXT) !== 0) {
      if ((nameListBits & NAME_LIST_LIST) !== 0) {
        throw new MarkupSyntaxError(
          "The element '" + name + "' is both in textElements and in listElements.",
          input,
          startIndex,
          endIndex
        );
      }
      kind = KIND_TEXT;
    } else if ((nameListBits & NAME_LIST_LIST) !== 0) {
      kind = KIND_LIST;
    }

    // List elements are stored like single elements
    const isSingle = kind === KIND_LIST || (nameListBits & NAME_LIST_SINGLE) !== 0;

    if (parentKind === KIND_DOCUMENT) {
      // A strict tokenizer throws the same error itself
      if (result !== undefined) {
        throw new MarkupSyntaxError('Expected a single root element.', input, startIndex, endIndex);
      }
    } else if (parentKind === KIND_LIST) {
      const itemName = listItemNameStack[cursor];

      if (itemName === undefined) {
        listItemNameStack[cursor] = name;
      } else if (itemName !== name) {
        throw new MarkupSyntaxError(
          "Expected child elements of the list element '" + elementInfoStack[cursor].name + "' to have the same name.",
          input,
          startIndex,
          endIndex
        );
      }
    } else if (isGrouped && isSingle && hasOwnProperty.call(parentValue, name)) {
      // Preceding siblings are ended, so the parent has the key of a sibling with the same name
      throw new MarkupSyntaxError(
        "Expected the element '" + name + "' to occur at most once in its parent.",
        input,
        startIndex,
        endIndex
      );
    }

    if (canNamesCollide) {
      const twin = elementInfo.twin;

      // The document has no value, and the root element has no siblings
      if (twin !== undefined && parentValue !== undefined && twin.parentValues![cursor] === parentValue) {
        throw new MarkupSyntaxError(
          "Expected child elements '" + name + "' to be in the same namespace.",
          input,
          startIndex,
          endIndex
        );
      }
      elementInfo.parentValues![cursor] = parentValue;
    }

    // In the ordered layout text that precedes a child element is an item of the content
    if (!isGrouped && text !== '') {
      const textValue =
        isSpaceRemoved && (parentFlags & FLAG_SPACE_PRESERVED) === 0 ? removeSpaces(text, isTextTrimmed) : text;

      if (textValue !== '') {
        pushContentItem(valueStack, contentStack, cursor, textValue);
      }
      text = '';
    }

    let value: any;

    if (kind === KIND_OBJECT) {
      value = {};
    } else if (kind === KIND_LIST) {
      value = [];
    }

    // Whitespace is preserved in descendants of an element that preserves it
    let flags = kind | (parentFlags & FLAG_SPACE_PRESERVED);

    if (isSingle) {
      flags |= FLAG_SINGLE;
    }

    for (let i = 0; i < attributeCount; ++i) {
      const attributeName = attributeNames[i];
      const attributeValue = attributeValues[i];

      if (isSpaceRemoved && attributeName === 'xml:space') {
        if (attributeValue === 'preserve') {
          flags |= FLAG_SPACE_PRESERVED;
        } else if (attributeValue === 'default') {
          flags &= ~FLAG_SPACE_PRESERVED;
        }
      }

      // Attributes of a text element aren't a part of the output
      if (kind === KIND_TEXT) {
        continue;
      }

      if (kind === KIND_LIST) {
        if (isNamespaceDeclaration(attributeName)) {
          continue;
        }
        throw new MarkupSyntaxError(
          "Expected the list element '" + name + "' to have no attributes.",
          input,
          startIndex,
          endIndex
        );
      }

      let attributeKey = attributeKeys[i];

      if (attributeKey === '') {
        // Namespace declarations aren't a part of the output if names are resolved
        if (isNamespaceDeclaration(attributeName)) {
          continue;
        }
        attributeKey = resolveAttributeKey(
          namespaceScope!,
          namespacePrefixMap!,
          attributeName,
          input,
          startIndex,
          endIndex
        );
      }

      // The first attribute key is always unique
      if (areAttributeKeysUnique && i !== 0 && hasOwnProperty.call(value, attributeKey)) {
        throw new MarkupSyntaxError(
          "Expected the attribute key '" + attributeKey + "' to be unique.",
          input,
          startIndex,
          endIndex
        );
      }

      value[attributeKey] = attributeValue;
    }

    // The content key follows attribute keys. In the ordered layout it's the last key, so it's added along with the
    // first item of the content.
    if (kind === KIND_OBJECT && isGrouped && !isEmptyContentOmitted) {
      value.$ = '';
    }

    textStack[cursor] = text;
    text = '';

    elementInfoStack[++cursor] = elementInfo;
    valueStack[cursor] = value;
    contentStack[cursor] = undefined;
    flagsStack[cursor] = flags;
    listItemNameStack[cursor] = undefined;
    declarationCountStack[cursor] = outerDeclarationCount;
  }

  // Ends the innermost enclosing element, and adds its value to the value of its parent
  function endElement(): void {
    const flags = flagsStack[cursor];
    const elementInfo = elementInfoStack[cursor];
    const name = elementInfo.name;
    const value = getElementValue();

    // Namespace declarations of the element are out of scope
    if (namespaceScope !== undefined) {
      namespaceScope.declarationCount = declarationCountStack[cursor];
    }

    text = textStack[--cursor];

    const parentFlags = flagsStack[cursor];
    const parentKind = parentFlags & KIND_MASK;
    const parentValue = valueStack[cursor];

    if (parentKind === KIND_DOCUMENT) {
      result = isRootUnwrapped ? value : createChildEntry(name, value);
      return;
    }

    if (parentKind === KIND_LIST) {
      parentValue.push(value);
      return;
    }

    if (!isGrouped) {
      pushContentItem(valueStack, contentStack, cursor, createChildEntry(name, value));
      return;
    }

    if ((flags & FLAG_SINGLE) !== 0) {
      flagsStack[cursor] = parentFlags | FLAG_CHILD_KEYS;
      setOwnProperty(parentValue, name, value);
      return;
    }

    // Preceding siblings with the same name are in the array
    if (elementInfo.lastParentValue === parentValue) {
      elementInfo.lastValues!.push(value);
      return;
    }

    let values;

    // An inherited property isn't an array of values
    if (hasOwnProperty.call(parentValue, name)) {
      values = parentValue[name];
      values.push(value);
    } else {
      values = [value];
      flagsStack[cursor] = parentFlags | FLAG_CHILD_KEYS;
      setOwnProperty(parentValue, name, values);
    }

    elementInfo.lastParentValue = parentValue;
    elementInfo.lastValues = values;
  }

  const tokenCallback: TokenCallback = (tokenKind, startIndex, endIndex, input) => {
    switch (tokenKind) {
      case 'text':
      case 'cdata_section': {
        const flags = flagsStack[cursor];
        const kind = flags & KIND_MASK;

        // Text outside the root element isn't a part of the output
        if (kind === KIND_DOCUMENT) {
          break;
        }

        // Blank text isn't copied from the input if it is ignored: a list element has no text, and whitespace at the
        // start of text is trimmed
        if (
          text === '' &&
          (kind === KIND_LIST || (isTextTrimmed && (flags & FLAG_SPACE_PRESERVED) === 0)) &&
          isBlank(input, startIndex, endIndex)
        ) {
          break;
        }

        let data = input.substring(startIndex, endIndex);

        if (tokenKind === 'text' && !isRawText) {
          data = decodeText(data);
        }

        if (kind !== KIND_LIST) {
          text += data;
          break;
        }

        // Decoded text can be blank, like "&#32;"
        if (!isBlank(data, 0, data.length)) {
          throw new MarkupSyntaxError(
            "Expected the list element '" + elementInfoStack[cursor].name + "' to have no text.",
            input,
            startIndex,
            endIndex
          );
        }
        break;
      }

      case 'start_tag_name': {
        const tagConfig = tokenizerState.tagConfig;

        isRawText = tagConfig !== undefined && tagConfig.isRawText;

        // Markup inside a text element isn't a part of the output
        if ((flagsStack[cursor] & KIND_MASK) === KIND_TEXT) {
          ++ignoredTagCount;
          break;
        }

        attributeCount = 0;

        // The tokenizer has hashed the name
        const tagHashCode = tokenizerState.tagHashCode;

        const firstEntry = tagEntryMap.get(tagHashCode);

        let entry = firstEntry;

        while (
          entry !== undefined &&
          !areTagNamesEqual(entry.tagName, 0, entry.tagName.length, input, startIndex, endIndex)
        ) {
          entry = entry.next;
        }

        if (entry === undefined) {
          entry = createTagEntry(input, startIndex, endIndex, config);
          entry.next = firstEntry;

          tagEntryMap.set(tagHashCode, entry);
        }

        tagEntry = entry;
        break;
      }

      case 'attribute_name':
        attributeNameStartIndex = startIndex;
        attributeNameEndIndex = endIndex;
        break;

      case 'attribute_value': {
        // Attributes of tags inside a text element
        if (ignoredTagCount !== 0) {
          break;
        }

        const attributeNames = tagEntry.attributeNames;

        // The name of the attribute that the preceding tag with the same name has at this index
        const attributeName = attributeCount < attributeNames.length ? attributeNames[attributeCount] : undefined;

        if (
          attributeName === undefined ||
          !areCaseSensitiveSubstringsEqual(
            attributeName,
            0,
            attributeName.length,
            input,
            attributeNameStartIndex,
            attributeNameEndIndex
          )
        ) {
          const name = input.substring(attributeNameStartIndex, attributeNameEndIndex);

          attributeNames[attributeCount] = name;

          // Keys of attributes that have a prefix or declare a namespace depend on namespace declarations
          tagEntry.attributeKeys[attributeCount] =
            namespaceScope !== undefined && (name.indexOf(':') !== -1 || name === 'xmlns') ? '' : '$' + name;
        }

        attributeValues[attributeCount++] = decodeAttribute(input.substring(startIndex, endIndex));
        break;
      }

      case 'start_tag_closing':
        if (ignoredTagCount === 0) {
          startElement(input, startIndex, endIndex);
        }
        break;

      case 'start_tag_self_closing':
        isRawText = false;

        if (ignoredTagCount === 0) {
          startElement(input, startIndex, endIndex);
          endElement();
        } else {
          --ignoredTagCount;
        }
        break;

      case 'end_tag_name':
        isRawText = false;

        if (ignoredTagCount === 0) {
          endElement();
        } else {
          --ignoredTagCount;
        }
        break;
    }
  };

  const tokenizerWriter = createTokenizerWriter(tokenCallback, config, tokenizerState);

  return {
    write(chunk) {
      tokenizerWriter.write(chunk);
      writtenLength += chunk.length;
    },

    end(chunk = '') {
      tokenizerWriter.end(chunk);

      if (isFragment) {
        return getElementValue();
      }

      if (result === undefined) {
        throw new MarkupSyntaxError('Expected a root element.', chunk, chunk.length, chunk.length, writtenLength);
      }
      return result;
    },
  };
}

/**
 * Creates an entry of a tag whose name is read from the input.
 *
 * @throws {@link MarkupSyntaxError} If names are resolved, and the tag name isn't a qualified name.
 */
function createTagEntry(input: string, startIndex: number, endIndex: number, config: JSONParserConfig): TagEntry {
  let tagName = input.substring(startIndex, endIndex);

  if (config.areTagNamesCaseInsensitive) {
    tagName = toASCIILowerCase(tagName);
  }

  const tagEntry: TagEntry = {
    tagName,
    next: undefined,
    prefix: '',
    localName: tagName,
    namespaceURI: undefined,
    elementInfo: undefined,
    attributeNames: [],
    attributeKeys: [],
  };

  // The tag name is the output name if names aren't resolved
  if (config.namespacePrefixMap === undefined) {
    tagEntry.elementInfo = createElementInfo(tagName, config);
    return tagEntry;
  }

  const colonIndex = tagName.indexOf(':');

  if (colonIndex === -1) {
    return tagEntry;
  }

  if (!isQualifiedName(tagName, colonIndex)) {
    throw new MarkupSyntaxError('Expected a qualified name.', input, startIndex, endIndex);
  }

  tagEntry.prefix = tagName.substring(0, colonIndex);
  tagEntry.localName = tagName.substring(colonIndex + 1);

  return tagEntry;
}

/**
 * Creates an info of elements with an output name.
 */
function createElementInfo(name: string, config: JSONParserConfig): ElementInfo {
  return {
    name,
    nameListBits: config.nameListBitsMap.get(name) ?? 0,
    isParentDependent: config.parentDependentNameSet.has(name),
    twin: undefined,
    parentValues: config.canNamesCollide ? [] : undefined,
    lastParentValue: undefined,
    lastValues: undefined,
  };
}

/**
 * Returns the URI of the namespace that a prefix is bound to, or an empty string if there's none. An empty prefix is
 * the prefix of the default namespace.
 */
function getNamespaceURI(namespaceScope: NamespaceScope, prefix: string): string {
  const prefixes = namespaceScope.prefixes;

  for (let i = namespaceScope.declarationCount - 1; i >= 0; --i) {
    if (prefixes[i] === prefix) {
      return namespaceScope.namespaceURIs[i];
    }
  }

  // The xml prefix is bound in every document
  return prefix === 'xml' ? XML_NAMESPACE_URI : '';
}

/**
 * Returns the prefix that names from a namespace have in the output.
 *
 * @param namespacePrefixMap The map from a namespace URI to the prefix of names in the output.
 * @param prefix The prefix of a name.
 * @param namespaceURI The namespace URI that the prefix is bound to.
 * @throws {@link MarkupSyntaxError} If the prefix isn't bound to a namespace, or the namespace isn't mapped.
 */
function getOutputPrefix(
  namespacePrefixMap: Map<string, string>,
  prefix: string,
  namespaceURI: string,
  input: string,
  startIndex: number,
  endIndex: number
): string {
  // Only the default namespace can be empty
  if (namespaceURI === '') {
    throw new MarkupSyntaxError("The namespace prefix '" + prefix + "' is not declared.", input, startIndex, endIndex);
  }

  const outputPrefix = namespacePrefixMap.get(namespaceURI);

  if (outputPrefix === undefined) {
    throw new MarkupSyntaxError("The namespace '" + namespaceURI + "' is not mapped.", input, startIndex, endIndex);
  }
  return outputPrefix;
}

/**
 * Returns the info of the element that a tag starts. Namespace declarations of the tag must be in scope.
 *
 * @throws {@link MarkupSyntaxError} If the tag name can't be resolved.
 */
function resolveElementInfo(
  namespaceScope: NamespaceScope,
  config: JSONParserConfig,
  tagEntry: TagEntry,
  input: string,
  startIndex: number,
  endIndex: number
): ElementInfo {
  const prefix = tagEntry.prefix;
  const namespaceURI = getNamespaceURI(namespaceScope, prefix);

  // The tag was resolved in the same namespace
  if (namespaceURI === tagEntry.namespaceURI) {
    return tagEntry.elementInfo!;
  }

  let name = tagEntry.localName;

  // A name without a prefix is in no namespace if there's no default namespace
  if (prefix !== '' || namespaceURI !== '') {
    const outputPrefix = getOutputPrefix(config.namespacePrefixMap!, prefix, namespaceURI, input, startIndex, endIndex);

    if (outputPrefix !== '') {
      name = outputPrefix + '$' + name;
    }
  }

  let elementInfo = namespaceScope.elementInfoMap.get(name);

  if (elementInfo === undefined) {
    elementInfo = createElementInfo(name, config);
    namespaceScope.elementInfoMap.set(name, elementInfo);
  }

  // An element in no namespace has the same output name as elements in the namespace that is mapped to the empty prefix
  if (config.canNamesCollide && namespaceURI === '') {
    if (elementInfo.twin === undefined) {
      elementInfo.twin = createElementInfo(name, config);
      elementInfo.twin.twin = elementInfo;
    }
    elementInfo = elementInfo.twin;
  }

  tagEntry.namespaceURI = namespaceURI;
  tagEntry.elementInfo = elementInfo;

  return elementInfo;
}

/**
 * Returns the key of an attribute that has a namespace prefix. Namespace declarations of its tag must be in scope.
 *
 * @throws {@link MarkupSyntaxError} If the attribute name can't be resolved.
 */
function resolveAttributeKey(
  namespaceScope: NamespaceScope,
  namespacePrefixMap: Map<string, string>,
  attributeName: string,
  input: string,
  startIndex: number,
  endIndex: number
): string {
  const colonIndex = attributeName.indexOf(':');

  if (!isQualifiedName(attributeName, colonIndex)) {
    throw new MarkupSyntaxError('Expected a qualified name.', input, startIndex, endIndex);
  }

  const prefix = attributeName.substring(0, colonIndex);
  const localName = attributeName.substring(colonIndex + 1);

  const outputPrefix = getOutputPrefix(
    namespacePrefixMap,
    prefix,
    getNamespaceURI(namespaceScope, prefix),
    input,
    startIndex,
    endIndex
  );

  return outputPrefix === '' ? '$' + localName : '$' + outputPrefix + '$' + localName;
}

/**
 * Returns `true` if an attribute declares a namespace: its name is `xmlns`, or `xmlns:` followed by a prefix.
 */
function isNamespaceDeclaration(attributeName: string): boolean {
  return attributeName === 'xmlns' || (attributeName.length > 6 && attributeName.startsWith('xmlns:'));
}

/**
 * Returns `true` if a name with a colon has a prefix and a local part that have no colons.
 *
 * @param name The name to check.
 * @param colonIndex The index of the first colon in the name.
 * @see [XML Qualified Names](https://www.w3.org/TR/xml-names/#ns-qualnames)
 */
function isQualifiedName(name: string, colonIndex: number): boolean {
  return colonIndex !== 0 && colonIndex !== name.length - 1 && name.indexOf(':', colonIndex + 1) === -1;
}

/**
 * Returns `true` if a substring consists of whitespace only.
 */
function isBlank(input: string, startIndex: number, endIndex: number): boolean {
  for (let i = startIndex; i < endIndex; ++i) {
    if (!isSpaceChar(input.charCodeAt(i))) {
      return false;
    }
  }
  return true;
}

/**
 * Removes whitespace from non-empty text: trims it, or returns an empty string if it's blank.
 *
 * @see {@link JSONParserOptions.whitespace}
 */
function removeSpaces(text: string, isTrimmed: boolean): string {
  if (isTrimmed) {
    return trimSpaces(text);
  }
  return isBlank(text, 0, text.length) ? '' : text;
}

/**
 * Removes whitespace from the start and the end of text. Unlike `String.prototype.trim`, removes only XML whitespace,
 * so chars like a no-break space are preserved.
 */
function trimSpaces(text: string): string {
  let startIndex = 0;
  let endIndex = text.length;

  while (startIndex < endIndex && isSpaceChar(text.charCodeAt(startIndex))) {
    ++startIndex;
  }
  while (startIndex < endIndex && isSpaceChar(text.charCodeAt(endIndex - 1))) {
    --endIndex;
  }
  return startIndex === 0 && endIndex === text.length ? text : text.substring(startIndex, endIndex);
}

/**
 * Adds an item to the content of the object of an enclosing element in the ordered layout. The content array is created
 * along with its first item, so an array with a single item doesn't reserve memory for more.
 */
function pushContentItem(valueStack: any[], contentStack: any[], cursor: number, item: unknown): void {
  const content = contentStack[cursor];

  if (content !== undefined) {
    content.push(item);
  } else {
    valueStack[cursor].$ = contentStack[cursor] = [item];
  }
}

/**
 * Returns an object with a single key, the name of an element, that holds the value of the element.
 *
 * The key isn't computed in an object literal, since V8 defines such key with a runtime call, which is several times
 * slower than an assignment.
 */
function createChildEntry(name: string, value: unknown): any {
  const childEntry = {};

  setOwnProperty(childEntry, name, value);

  return childEntry;
}

/**
 * Sets an own property of an object. Unlike an assignment, doesn't change the prototype of the object if the key is
 * `__proto__`.
 */
function setOwnProperty(object: any, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true });
  } else {
    object[key] = value;
  }
}

/**
 * Returns a copy of an element object that has the content key between attribute keys and keys of child elements.
 */
function insertContentKey(object: any, content: string): any {
  const result: any = {};

  let isContentKeyInserted = false;

  for (const key of Object.keys(object)) {
    // Attribute keys start with "$", and keys of child elements follow them
    if (!isContentKeyInserted && key.charCodeAt(0) !== /* $ */ 36) {
      result.$ = content;
      isContentKeyInserted = true;
    }
    setOwnProperty(result, key, object[key]);
  }
  return result;
}
