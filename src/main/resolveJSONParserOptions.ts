import { type ParserConfig, resolveParserOptions } from './resolveParserOptions.ts';
import type { JSONParserOptions } from './types.ts';
import { assert } from './utils.ts';

export interface JSONParserConfig extends ParserConfig {
  /**
   * `true` if {@link JSONParserOptions.layout} is `'grouped'`.
   */
  isGrouped: boolean;

  /**
   * `true` if {@link JSONParserOptions.whitespace} is `'trim'`.
   */
  isTextTrimmed: boolean;

  /**
   * `true` if {@link JSONParserOptions.whitespace} is `'drop_blank'`.
   */
  isBlankTextDropped: boolean;

  /**
   * `true` if {@link JSONParserOptions.emptyContent} is `'omit'`.
   */
  isEmptyContentOmitted: boolean;

  /**
   * `true` if {@link JSONParserOptions.root} is `'unwrap'`.
   */
  isRootUnwrapped: boolean;

  /**
   * The map from a namespace URI to the prefix that names in this namespace have in the output, or `undefined` if
   * names aren't resolved.
   *
   * @see {@link JSONParserOptions.namespaces}
   */
  namespacePrefixMap: Map<string, string> | undefined;

  /**
   * `true` if a namespace is mapped to the `''` prefix. Then names in this namespace have no prefix in the output, like
   * names that are in no namespace, so names from different namespaces can be the same in the output.
   */
  canNamesCollide: boolean;

  /**
   * The map from an entry of a name list to bits of name lists that have this entry.
   *
   * @see {@link NAME_LIST_TEXT}
   * @see {@link NAME_LIST_LIST}
   * @see {@link NAME_LIST_SINGLE}
   */
  nameListBitsMap: Map<string, number>;

  /**
   * Names of elements from entries of name lists that have a parent name, like `title` from `item/title`. Name lists
   * are looked up by a parent name only for elements with these names.
   */
  parentDependentNameSet: Set<string>;
}

/**
 * The bit of {@link JSONParserOptions.textElements}.
 */
export const NAME_LIST_TEXT = 1;

/**
 * The bit of {@link JSONParserOptions.listElements}.
 */
export const NAME_LIST_LIST = 2;

/**
 * The bit of {@link JSONParserOptions.singleElements}.
 */
export const NAME_LIST_SINGLE = 4;

/**
 * The namespace URI that the `xml` prefix is bound to in every document.
 */
export const XML_NAMESPACE_URI = 'http://www.w3.org/XML/1998/namespace';

// https://www.w3.org/TR/xml/#NT-NameStartChar without a colon
const ncNameStartChars =
  'A-Z_a-z\\xC0-\\xD6\\xD8-\\xF6\\xF8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF' +
  '\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}';

// https://www.w3.org/TR/xml-names/#NT-NCName
const ncNameRegex = new RegExp(
  '^[' + ncNameStartChars + '][' + ncNameStartChars + '\\-.0-9\\xB7\\u0300-\\u036F\\u203F\\u2040]*$',
  'u'
);

// A name, or names of a parent and a child separated by a slash
const nameListEntryRegex = /^[^/]+(?:\/[^/]+)?$/;

/**
 * Converts JSON parser options into the config consumed by a JSON parser.
 *
 * @throws Error If options are invalid.
 */
export function resolveJSONParserOptions(options: JSONParserOptions): JSONParserConfig {
  const {
    layout = 'ordered',
    whitespace = 'preserve',
    emptyContent = 'keep',
    root = 'wrap',
    namespaces,
    textElements = [],
    singleElements = [],
    listElements = [],
  } = options;

  assert(layout === 'ordered' || layout === 'grouped', "layout must be 'ordered' or 'grouped'");
  assert(
    whitespace === 'preserve' || whitespace === 'drop_blank' || whitespace === 'trim',
    "whitespace must be 'preserve', 'drop_blank' or 'trim'"
  );
  assert(emptyContent === 'keep' || emptyContent === 'omit', "emptyContent must be 'keep' or 'omit'");
  assert(root === 'wrap' || root === 'unwrap', "root must be 'wrap' or 'unwrap'");

  const nameListBitsMap = new Map<string, number>();
  const parentDependentNameSet = new Set<string>();

  function addNameList(entries: readonly string[], nameListBit: number, optionName: string): void {
    for (const entry of entries) {
      assert(
        typeof entry === 'string' && nameListEntryRegex.test(entry),
        optionName + " entries must be like 'name' or 'parent/name'"
      );

      nameListBitsMap.set(entry, (nameListBitsMap.get(entry) ?? 0) | nameListBit);

      const separatorIndex = entry.indexOf('/');

      if (separatorIndex !== -1) {
        parentDependentNameSet.add(entry.substring(separatorIndex + 1));
      }
    }
  }

  addNameList(textElements, NAME_LIST_TEXT, 'textElements');
  addNameList(listElements, NAME_LIST_LIST, 'listElements');
  addNameList(singleElements, NAME_LIST_SINGLE, 'singleElements');

  let namespacePrefixMap;
  let canNamesCollide = false;

  if (namespaces !== undefined) {
    namespacePrefixMap = new Map<string, string>();

    for (const [prefix, namespaceURI] of Object.entries(namespaces)) {
      assert(prefix === '' || ncNameRegex.test(prefix), "namespaces prefixes must be XML names without colons, or ''");
      assert(prefix !== 'xml' || namespaceURI === XML_NAMESPACE_URI, 'namespaces.xml must be ' + XML_NAMESPACE_URI);
      assert(!namespacePrefixMap.has(namespaceURI), 'namespaces must not map a namespace URI to several prefixes');

      namespacePrefixMap.set(namespaceURI, prefix);

      // Names are in no namespace if the namespace URI is empty
      if (prefix === '' && namespaceURI !== '') {
        canNamesCollide = true;
      }
    }

    if (!namespacePrefixMap.has(XML_NAMESPACE_URI)) {
      namespacePrefixMap.set(XML_NAMESPACE_URI, 'xml');
    }
  }

  return {
    ...resolveParserOptions(options),
    isGrouped: layout === 'grouped',
    isTextTrimmed: whitespace === 'trim',
    isBlankTextDropped: whitespace === 'drop_blank',
    isEmptyContentOmitted: emptyContent === 'omit',
    isRootUnwrapped: root === 'unwrap',
    namespacePrefixMap,
    canNamesCollide,
    nameListBitsMap,
    parentDependentNameSet,
  };
}
