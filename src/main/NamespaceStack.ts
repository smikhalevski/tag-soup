import { XML_NAMESPACE, XMLNS_NAMESPACE } from 'flyweight-dom';

/**
 * Namespaces that are in scope of the element being read, declared by `xmlns` and `xmlns:*` attributes of the element
 * and of its enclosing elements.
 *
 * For each element, call {@link declareNamespace} for its attributes, then {@link getNamespaceURI} for its tag name,
 * then {@link startElement}, and {@link endElement} when the element is ended.
 *
 * Most elements declare no namespaces, so a scope is created only for an element that declares one, and other
 * elements cost a counter update.
 *
 * Arrays are stacks that are indexed by a cursor and never shrink, so entries above a cursor are stale, and are
 * overwritten by later declarations.
 *
 * @internal
 */
export class NamespaceStack {
  /**
   * The namespace of elements that have no prefix, or `null` if there's none.
   */
  defaultNamespaceURI: string | null = null;

  /**
   * Prefixes declared by `xmlns:*` attributes of enclosing elements, the innermost declaration is at
   * {@link prefixCursor}.
   */
  prefixes: string[] = [];

  /**
   * Namespaces that {@link prefixes} are bound to, by the index of the prefix. `null` if a prefix is unbound by an
   * empty attribute value.
   */
  namespaceURIs: Array<string | null> = [];

  /**
   * The index of the innermost declared prefix, or -1 if no prefixes are declared.
   */
  prefixCursor = -1;

  /**
   * The number of elements that are started and not yet ended.
   */
  depth = 0;

  /**
   * Depths of the elements that declare namespaces. Other arrays of scopes share the index.
   */
  scopeDepths: number[] = [];

  /**
   * {@link prefixCursor} outside of each scope, restored when the scope ends.
   */
  scopePrefixCursors: number[] = [];

  /**
   * {@link defaultNamespaceURI} outside of each scope, restored when the scope ends.
   */
  scopeDefaultNamespaceURIs: Array<string | null> = [];

  /**
   * The index of the innermost scope, or -1 if no enclosing element declares namespaces.
   */
  scopeCursor = -1;

  /**
   * Declares a namespace in the scope of the element being read, if the attribute is `xmlns` or `xmlns:*`. Other
   * attributes are ignored.
   *
   * @param attributeName The name of the attribute.
   * @param attributeValue The decoded value of the attribute. An empty value removes the namespace.
   */
  declareNamespace(attributeName: string, attributeValue: string): void {
    // Most attributes are ruled out by the first char
    if (attributeName.charCodeAt(0) !== /* x */ 120 || !attributeName.startsWith('xmlns')) {
      return;
    }

    const isDefaultNamespace = attributeName.length === 5;

    // "xmlns:" must be followed by a prefix
    if (!isDefaultNamespace && (attributeName.charCodeAt(5) !== /* : */ 58 || attributeName.length === 6)) {
      return;
    }

    // The element being read isn't started yet
    const scopeDepth = this.depth + 1;

    // Scopes of elements that were ended are removed, so only the element being read can have a scope at this depth
    if (this.scopeCursor === -1 || this.scopeDepths[this.scopeCursor] !== scopeDepth) {
      const scopeCursor = ++this.scopeCursor;

      this.scopeDepths[scopeCursor] = scopeDepth;
      this.scopePrefixCursors[scopeCursor] = this.prefixCursor;
      this.scopeDefaultNamespaceURIs[scopeCursor] = this.defaultNamespaceURI;
    }

    const namespaceURI = attributeValue.length === 0 ? null : attributeValue;

    if (isDefaultNamespace) {
      this.defaultNamespaceURI = namespaceURI;
      return;
    }

    const prefixCursor = ++this.prefixCursor;

    this.prefixes[prefixCursor] = attributeName.substring(6);
    this.namespaceURIs[prefixCursor] = namespaceURI;
  }

  /**
   * Returns the namespace of an element with the given tag name: the namespace that the prefix of the tag name is
   * bound to, or the default namespace if there's no prefix. Returns `null` if the element has no namespace.
   *
   * Namespaces declared by the element itself must be {@link declareNamespace declared} before this call.
   *
   * @param tagName The tag name with an optional prefix.
   */
  getNamespaceURI(tagName: string): string | null {
    const prefixLength = tagName.indexOf(':');

    if (prefixLength === -1) {
      return this.defaultNamespaceURI;
    }

    // Prefixes that are always bound and can't be declared
    if (prefixLength === 3 && tagName.startsWith('xml')) {
      return XML_NAMESPACE;
    }

    if (prefixLength === 5 && tagName.startsWith('xmlns')) {
      return XMLNS_NAMESPACE;
    }

    const { prefixes } = this;

    // The innermost declaration of a prefix wins. Prefixes are compared in place, so the tag name isn't split.
    for (let index = this.prefixCursor; index !== -1; --index) {
      const prefix = prefixes[index];

      if (prefix.length === prefixLength && tagName.startsWith(prefix)) {
        return this.namespaceURIs[index];
      }
    }

    return null;
  }

  /**
   * Starts the element being read, so namespaces declared after this call are in the scope of its child.
   */
  startElement(): void {
    ++this.depth;
  }

  /**
   * Ends the innermost started element, and removes namespaces that it has declared.
   */
  endElement(): void {
    const depth = this.depth--;
    const scopeCursor = this.scopeCursor;

    if (scopeCursor === -1 || this.scopeDepths[scopeCursor] !== depth) {
      return;
    }

    this.prefixCursor = this.scopePrefixCursors[scopeCursor];
    this.defaultNamespaceURI = this.scopeDefaultNamespaceURIs[scopeCursor];
    this.scopeCursor = scopeCursor - 1;
  }
}
