import { MarkupSyntaxError } from './MarkupSyntaxError.ts';
import type { TagParsingConfig, TokenizerConfig, TokenizerContext } from './resolveTokenizerOptions.ts';
import type { TokenHandler, TokenizerWriter } from './types.ts';
import { type SubstringComparer, toLowerCaseCharCode as __toLowerCaseCharCode } from './utils.ts';

/**
 * Creates a writer that reads tokens from chunks of text and passes them to a handler. Tokens are balanced: each start
 * tag gets an end tag, unless it's self-closing.
 *
 * @param handler The handler that receives tokens.
 * @param config The config from {@link resolveTokenizerOptions}.
 * @internal
 */
export function createTokenizerWriter(handler: TokenHandler, config: TokenizerConfig): TokenizerWriter {
  const state = createTokenizerState(config);
  const tagStack = createTagStack(config);

  // The unread end of the previous input, the next chunk is appended to it
  let unreadInput = '';
  let isEnded = false;

  const readChunk = (chunk: string, isInputEnded: boolean): void => {
    if (isEnded) {
      throw new Error('The writer was ended.');
    }

    // Nothing new to read
    if (chunk.length === 0 && !isInputEnded) {
      return;
    }

    // Stays `true` if reading throws, since the state can be inconsistent after that
    isEnded = true;

    // join() makes a flat string, which V8 reads faster than the cons string (two linked parts) that `+` makes
    const input = unreadInput.length === 0 ? chunk : [unreadInput, chunk].join('');

    try {
      const unreadStartIndex = readTokens(input, isInputEnded, handler, config, state, tagStack);

      if (isInputEnded) {
        endEnclosingTags(tagStack, handler, config, state.scope, input);

        // The writer stays ended
        return;
      }

      copyChunkTagNames(tagStack, input);

      unreadInput = input.substring(unreadStartIndex);
      writer.inputOffset = state.inputOffset += unreadStartIndex;
    } catch (error) {
      writer.inputOffset = state.inputOffset;

      // Error indices point into the input, so add where the input starts in the stream
      if (error instanceof MarkupSyntaxError && error.input === input) {
        error.inputOffset = state.inputOffset;
      }
      throw error;
    }

    isEnded = false;
  };

  const writer = {
    inputOffset: 0,

    write(chunk) {
      readChunk(chunk, false);
    },

    end(chunk = '') {
      readChunk(chunk, true);
    },
  } satisfies TokenizerWriter;

  return writer;
}

// Before the first tag or text of a document: spaces are skipped and DOCTYPE is recognized
const SCOPE_PROLOGUE = 0;

// Content after the prologue, and all content of a fragment
const SCOPE_TEXT = 1;

// Inside a start tag, after its name. Saved in the state only when a chunk ends inside a start tag.
const SCOPE_START_TAG = 2;

type Scope = typeof SCOPE_PROLOGUE | typeof SCOPE_TEXT | typeof SCOPE_START_TAG;

// Selects the low 4 bits of a tag name hash code, the index in TagStack.enclosingTagHashCodeCounts
const ENCLOSING_TAG_HASH_CODE_MASK = 0b1111;

// V8 checks an imported function at every call, but inlines a local constant without a check
const toLowerCaseCharCode = __toLowerCaseCharCode;

/**
 * Where reading resumes in the next chunk. The {@link TagStack} holds the rest of what reading needs to resume.
 *
 * @see {@link createTokenizerState}
 * @internal
 */
interface TokenizerState {
  /**
   * The scope in which the tokenizer has stopped.
   */
  scope: Scope;

  /**
   * The length of text at the start of the input that was already scanned and has no tokens, so it isn't scanned again.
   */
  scannedLength: number;

  /**
   * The index in the stream where the input starts. The stream is all chunks that were written, and the input is the
   * part of the stream that wasn't read before, followed by the last written chunk.
   *
   * @see {@link TokenizerWriter.inputOffset}
   */
  inputOffset: number;
}

/**
 * Enclosing tags (started and not yet ended) that {@link readTokens} balances end tags against. A writer keeps one
 * stack for all chunks. Arrays indexed by tag share the index, and {@link cursor} is the index of the innermost tag.
 * It also holds the current context, which foreign tags switch, and whether the root element was read.
 *
 * @see {@link createTagStack}
 * @internal
 */
interface TagStack {
  /**
   * Start indices of tag names in the input.
   */
  tagNameStartIndices: number[];

  /**
   * End indices of tag names in the input.
   */
  tagNameEndIndices: number[];

  /**
   * Hash codes of tag names. When an end tag doesn't match the innermost tag, the stack is searched by hash code, and
   * names are compared only if hash codes are equal.
   */
  tagHashCodes: number[];

  /**
   * Tag configs, `undefined` for tags without a config in the context they were started in.
   */
  tagConfigs: Array<TagParsingConfig | undefined>;

  /**
   * {@link enclosingGroupBits} from before each tag was started, restored when the tag ends, so tags of each group
   * don't have to be counted.
   */
  outerGroupBits: number[];

  /**
   * Names of tags started in previous chunks, copied since the writer drops the input that was read. These tags are at
   * the bottom of the stack, below {@link previousChunkTagCount}.
   */
  previousChunkTagNames: string[];

  /**
   * The index of the innermost tag, or -1 if the stack is empty.
   */
  cursor: number;

  /**
   * The number of tags started in previous chunks.
   */
  previousChunkTagCount: number;

  /**
   * Bitwise OR of {@link TagParsingConfig.groupBit} of all enclosing tags.
   */
  enclosingGroupBits: number;

  /**
   * Counts of enclosing tags by the low 4 bits of their name hash code. If the count for an end tag is 0, no enclosing
   * tag has its name, so the stack isn't searched. Different names can share a count, which costs a search but doesn't
   * change the result.
   *
   * Most end tags match the innermost tag and need no counts, so tags are counted lazily, when the stack is searched.
   * Only tags below {@link countedTagCount} are counted.
   */
  enclosingTagHashCodeCounts: number[];

  /**
   * The number of tags at the bottom of the stack that are counted in {@link enclosingTagHashCodeCounts}.
   */
  countedTagCount: number;

  /**
   * The context of the content being read. Foreign tags switch it, so code reads it from here on every use.
   */
  context: TokenizerContext;

  /**
   * The context outside each enclosing foreign tag, pushed when the tag starts and restored when it ends.
   */
  outerContexts: TokenizerContext[];

  /**
   * `true` once the root element of a document was started, so a strict tokenizer rejects a second one.
   */
  isRootElementRead: boolean;
}

/**
 * Creates an empty tag stack in the initial context of the config.
 *
 * @internal
 */
export function createTagStack(config: TokenizerConfig): TagStack {
  // Number arrays start with a few zeros, so storing the first tags doesn't grow them. The counts array has a zero for
  // each of the 16 values of the low hash code bits, since any of them can be read.
  return {
    tagNameStartIndices: [0, 0, 0, 0, 0, 0, 0, 0],
    tagNameEndIndices: [0, 0, 0, 0, 0, 0, 0, 0],
    tagHashCodes: [0, 0, 0, 0, 0, 0, 0, 0],
    previousChunkTagNames: [],
    tagConfigs: [],
    enclosingGroupBits: 0,
    outerGroupBits: [0, 0, 0, 0, 0, 0, 0, 0],
    enclosingTagHashCodeCounts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    countedTagCount: 0,
    outerContexts: [],
    cursor: -1,
    context: config.rootContext,
    previousChunkTagCount: 0,
    isRootElementRead: false,
  };
}

/**
 * Creates the state for reading a document or a fragment from the start.
 *
 * @internal
 */
export function createTokenizerState(config: TokenizerConfig): TokenizerState {
  return {
    scope: config.isFragment ? SCOPE_TEXT : SCOPE_PROLOGUE,
    scannedLength: 0,
    inputOffset: 0,
  };
}

// Module-private helpers are `const` arrow functions: a function declaration is a mutable binding, so V8 checks it at
// every inlined call, while a constant is inlined without a check.

/**
 * Ends the tags that are still enclosing at the end of the input.
 */
const endEnclosingTags = (
  tagStack: TagStack,
  handler: TokenHandler,
  config: TokenizerConfig,
  scope: Scope,
  input: string
): void => {
  const inputLength = input.length;

  if (tagStack.cursor !== -1 && !config.areUnbalancedStartTagsImplicitlyEnded) {
    throw new MarkupSyntaxError('Unexpected end of the document.', input, inputLength);
  }

  // The input ended inside a start tag, so close it
  if (scope === SCOPE_START_TAG) {
    handler.onStartTagClosing?.(input, inputLength, inputLength);

    const tagConfig = tagStack.tagConfigs[tagStack.cursor];

    if (tagConfig?.kind === 'void') {
      handler.onEndTagName?.(input, inputLength, inputLength);
      popTag(tagStack);
    }
  }

  while (tagStack.cursor !== -1) {
    handler.onEndTagName?.(input, inputLength, inputLength);
    popTag(tagStack);
  }
};

/**
 * Pops the innermost tag, and restores the outer context if the tag is foreign. readTokens pops an end tag that matches
 * the innermost tag inline, keep them in sync.
 */
const popTag = (tagStack: TagStack): void => {
  const cursor = tagStack.cursor--;

  // Tags from previous chunks are at the bottom of the stack
  if (cursor < tagStack.previousChunkTagCount) {
    tagStack.previousChunkTagCount = cursor;
  }

  if (cursor < tagStack.countedTagCount) {
    tagStack.countedTagCount = cursor;
    --tagStack.enclosingTagHashCodeCounts[tagStack.tagHashCodes[cursor] & ENCLOSING_TAG_HASH_CODE_MASK];
  }

  tagStack.enclosingGroupBits = tagStack.outerGroupBits[cursor];

  const tagConfig = tagStack.tagConfigs[cursor];

  if (tagConfig?.foreignContext !== undefined) {
    tagStack.context = tagStack.outerContexts.pop()!;
  }
};

/**
 * Copies names of tags started in this chunk, since the writer drops the input, and drops names of ended tags. V8
 * copies a substring shorter than 13 chars, while a longer one is a slice that keeps the input alive while its tag is
 * open.
 */
const copyChunkTagNames = (tagStack: TagStack, input: string): void => {
  const { tagNameStartIndices, tagNameEndIndices, previousChunkTagNames } = tagStack;

  let tagIndex = tagStack.previousChunkTagCount;

  for (; tagIndex <= tagStack.cursor; ++tagIndex) {
    previousChunkTagNames[tagIndex] = input.substring(tagNameStartIndices[tagIndex], tagNameEndIndices[tagIndex]);
  }

  tagStack.previousChunkTagCount = tagIndex;

  // Drop names of ended tags
  previousChunkTagNames.length = tagIndex;
};

/**
 * Returns the index of the innermost tag with the name of the end tag, or -1 if there's none. Names are compared only
 * for tags with the hash code of the end tag, and equal hash codes make the last chars equal, so comparisons skip them
 * by passing end indices minus 1, see {@link getCaseInsensitiveHashCode}.
 *
 * First counts the tags pushed since the previous search, see {@link TagStack.countedTagCount}, so it updates the
 * stack.
 */
const getEnclosingTagIndex = (
  tagStack: TagStack,
  areSubstringsEqual: SubstringComparer,
  endTagHashCode: number,
  input: string,
  endTagNameStartIndex: number,
  endTagNameEndIndex: number
): number => {
  const { tagHashCodes, enclosingTagHashCodeCounts } = tagStack;

  // Count tags that were started since the previous search
  for (let index = tagStack.countedTagCount; index <= tagStack.cursor; ++index) {
    ++enclosingTagHashCodeCounts[tagHashCodes[index] & ENCLOSING_TAG_HASH_CODE_MASK];
  }
  tagStack.countedTagCount = tagStack.cursor + 1;

  // No enclosing tag has these low hash code bits
  if (enclosingTagHashCodeCounts[endTagHashCode & ENCLOSING_TAG_HASH_CODE_MASK] === 0) {
    return -1;
  }

  const { tagNameStartIndices, tagNameEndIndices, previousChunkTagNames, previousChunkTagCount } = tagStack;

  let index = tagStack.cursor;

  for (; index >= previousChunkTagCount; --index) {
    if (
      tagHashCodes[index] === endTagHashCode &&
      areSubstringsEqual(
        input,
        tagNameStartIndices[index],
        tagNameEndIndices[index] - 1,
        input,
        endTagNameStartIndex,
        endTagNameEndIndex - 1
      )
    ) {
      return index;
    }
  }

  // Tags from previous chunks, compared by their copied names
  for (; index !== -1; --index) {
    if (tagHashCodes[index] !== endTagHashCode) {
      continue;
    }

    const tagName = previousChunkTagNames[index];

    if (areSubstringsEqual(tagName, 0, tagName.length - 1, input, endTagNameStartIndex, endTagNameEndIndex - 1)) {
      return index;
    }
  }
  return -1;
};

/**
 * Ends the outermost enclosing tag that a tag implicitly ends, and the tags inside it. Tags outside the nearest
 * implicit ending boundary aren't ended.
 *
 * @param tagStack The stack of enclosing tags.
 * @param handler The handler that receives the inserted end tags.
 * @param endingTagConfig The config of the tag that ends enclosing tags.
 * @param insertionIndex The index in the input that the inserted end tags point to.
 * @param input The text that the insertion index points to.
 */
const insertImplicitEndTags = (
  tagStack: TagStack,
  handler: TokenHandler,
  endingTagConfig: TagParsingConfig,
  insertionIndex: number,
  input: string
): void => {
  const { tagConfigs } = tagStack;

  // Find the nearest boundary, skipping boundaries that are implicitly ended themselves
  let index = tagStack.cursor;

  while (
    index !== -1 &&
    (!isImplicitEndingBoundary(tagConfigs[index]) || isImplicitlyEndedBy(tagConfigs[index], endingTagConfig))
  ) {
    --index;
  }

  // Find the outermost tag that must be ended
  ++index;

  while (index <= tagStack.cursor && !isImplicitlyEndedBy(tagConfigs[index], endingTagConfig)) {
    ++index;
  }

  while (index <= tagStack.cursor) {
    handler.onEndTagName?.(input, insertionIndex, insertionIndex);
    popTag(tagStack);
  }
};

/**
 * Ends the enclosing tags that a start tag implicitly ends, and returns the config of the start tag in the context that
 * is current after that, since ending a foreign tag restores the outer context.
 *
 * @param tagStack The stack of enclosing tags.
 * @param handler The handler that receives the inserted end tags.
 * @param startTagConfig The config of the start tag in the context where it was read.
 * @param input The text that indices point to.
 * @param tagNameStartIndex The start index of the start tag name, inclusive.
 * @param tagNameEndIndex The end index of the start tag name, exclusive.
 * @param areSubstringsEqual Compares substrings.
 */
const insertImplicitEndTagsBeforeStartTag = (
  tagStack: TagStack,
  handler: TokenHandler,
  startTagConfig: TagParsingConfig,
  input: string,
  tagNameStartIndex: number,
  tagNameEndIndex: number,
  areSubstringsEqual: SubstringComparer
): TagParsingConfig | undefined => {
  const context = tagStack.context;

  // End tags are inserted before "<"
  insertImplicitEndTags(tagStack, handler, startTagConfig, tagNameStartIndex - 1, input);

  // The context didn't change, so neither did the config
  if (tagStack.context === context) {
    return startTagConfig;
  }

  // Look the start tag up again in the restored context, the config holds its hash code
  return getTagConfig(
    tagStack.context,
    startTagConfig.tagHashCode,
    input,
    tagNameStartIndex,
    tagNameEndIndex,
    areSubstringsEqual
  );
};

/**
 * Balances an end tag that {@link readTokens} didn't match with the innermost tag, because the stack is empty, the
 * names differ, or that tag is from a previous chunk. Ends the matching enclosing tag and the tags inside it, or inserts
 * the start tag of an implicitly started tag, or ignores or rejects the end tag.
 */
const balanceEndTag = (
  tagStack: TagStack,
  handler: TokenHandler,
  config: TokenizerConfig,
  input: string,
  endTagNameStartIndex: number,
  endTagNameEndIndex: number
): void => {
  const {
    areSubstringsEqual,
    getSubstringHashCode,
    areUnbalancedStartTagsImplicitlyEnded,
    areUnbalancedEndTagsIgnored,
  } = config;

  // The index of "</"
  const endTagStartIndex = endTagNameStartIndex - 2;

  const endTagHashCode = getSubstringHashCode(input, endTagNameStartIndex, endTagNameEndIndex);

  const enclosingTagIndex = getEnclosingTagIndex(
    tagStack,
    areSubstringsEqual,
    endTagHashCode,
    input,
    endTagNameStartIndex,
    endTagNameEndIndex
  );

  // The end tag matches an enclosing tag
  if (enclosingTagIndex !== -1) {
    if (!areUnbalancedStartTagsImplicitlyEnded && enclosingTagIndex !== tagStack.cursor) {
      throw new MarkupSyntaxError('Expected an end tag.', input, endTagStartIndex);
    }

    // End the tags inside the matching tag
    while (enclosingTagIndex < tagStack.cursor) {
      handler.onEndTagName?.(input, endTagStartIndex, endTagStartIndex);
      popTag(tagStack);
    }

    handler.onEndTagName?.(input, endTagNameStartIndex, endTagNameEndIndex);
    popTag(tagStack);
    return;
  }

  // Like a start tag, an unbalanced end tag has the config of the context it's read in
  const endTagConfig = getTagConfig(
    tagStack.context,
    endTagHashCode,
    input,
    endTagNameStartIndex,
    endTagNameEndIndex,
    areSubstringsEqual
  );

  if (endTagConfig === undefined || !endTagConfig.isImplicitlyStarted) {
    if (!areUnbalancedEndTagsIgnored) {
      throw new MarkupSyntaxError('Unexpected end tag.', input, endTagNameStartIndex, endTagNameEndIndex);
    }
    return;
  }

  if ((tagStack.enclosingGroupBits & endTagConfig.endedGroupBits) !== 0) {
    insertImplicitEndTags(tagStack, handler, endTagConfig, endTagStartIndex, input);
  }

  handler.onStartTagName?.(input, endTagNameStartIndex, endTagNameEndIndex);
  handler.onStartTagClosing?.(input, endTagNameEndIndex, endTagNameEndIndex + 1);
  handler.onEndTagName?.(input, endTagNameStartIndex, endTagNameEndIndex);
};

/**
 * Returns the config of a tag in a context, or `undefined` if there's none. Names can share a hash code, so the name is
 * compared too, for equal hash codes, which make the last chars equal, so comparisons skip them by passing end indices
 * minus 1, see {@link getCaseInsensitiveHashCode}.
 *
 * @see {@link createTagConfigTable}
 */
const getTagConfig = (
  context: TokenizerContext,
  tagHashCode: number,
  input: string,
  tagNameStartIndex: number,
  tagNameEndIndex: number,
  areSubstringsEqual: SubstringComparer
): TagParsingConfig | undefined => {
  // The same lookup is written in readTokens, keep them in sync
  let tagConfig: TagParsingConfig | undefined;

  const tagConfigTable = context.tagConfigTable;
  const indexMask = tagConfigTable.length - 1;

  let tagConfigIndex = tagHashCode & indexMask;

  // An empty slot ends the lookup
  while ((tagConfig = tagConfigTable[tagConfigIndex]) !== undefined) {
    if (
      tagConfig.tagHashCode === tagHashCode &&
      areSubstringsEqual(
        tagConfig.tagName,
        0,
        tagConfig.tagName.length - 1,
        input,
        tagNameStartIndex,
        tagNameEndIndex - 1
      )
    ) {
      break;
    }
    tagConfigIndex = (tagConfigIndex + 1) & indexMask;
  }

  return tagConfig;
};

/**
 * Returns `true` if a tag limits implicit ending.
 *
 * @see {@link TagParsingOptions.isImplicitEndingBoundary}
 */
const isImplicitEndingBoundary = (tagConfig: TagParsingConfig | undefined): boolean => {
  return tagConfig !== undefined && tagConfig.isImplicitEndingBoundary;
};

/**
 * Returns `true` if starting the ending tag implicitly ends the tag. Group bits rule out most tags before the name set
 * is checked.
 */
const isImplicitlyEndedBy = (tagConfig: TagParsingConfig | undefined, endingTagConfig: TagParsingConfig): boolean => {
  return (
    tagConfig !== undefined &&
    (tagConfig.groupBit & endingTagConfig.endedGroupBits) !== 0 &&
    tagConfig.implicitEndingTagNameSet.has(endingTagConfig.tagName)
  );
};

/**
 * Reads tokens from text and passes them to a handler, balancing tags on the way: inserts missing end tags, ends and
 * starts tags implicitly, ignores or rejects stray end tags, and switches the context at foreign tags.
 *
 * If the input isn't ended, trailing text and a token that reaches the end of the input aren't passed to the handler,
 * since they can continue in the next chunk. Read the unread text followed by the next chunk with the same state and
 * stack. Use {@link createTokenizerWriter}, which does that and ends tags at the end of the input.
 *
 * @param input The text to read tokens from.
 * @param isInputEnded If `false` then more chunks can follow the input.
 * @param handler The handler that receives tokens.
 * @param config The config from {@link resolveTokenizerOptions}.
 * @param state The state where reading resumes in the next chunk.
 * @param tagStack The stack of enclosing tags.
 * @returns The index in the input where the unread text starts, or the input length if all of it was read.
 * @throws {@link MarkupSyntaxError} If {@link TokenizerConfig.isStrict} is `true` and input is malformed, or if
 *   options don't allow to balance tags.
 * @internal
 */
export function readTokens(
  input: string,
  isInputEnded: boolean,
  handler: TokenHandler,
  config: TokenizerConfig,
  state: TokenizerState,
  tagStack: TagStack
): number {
  const { areTagNamesCaseInsensitive, areSubstringsEqual, isFragment, isStrict } = config;

  const inputLength = input.length;

  // A token that reaches this index can continue in the next chunk, so reading stops, or -1 if the input is ended
  const openEndIndex = isInputEnded ? -1 : inputLength;

  const skipName = isStrict ? skipXMLName : skipHTMLName;

  let scope = state.scope;

  let textStartIndex = scope === SCOPE_PROLOGUE ? skipSpaces(input, 0) : 0;

  // On resume the innermost tag is the start tag being read, or the raw text tag whose text is being read, since raw
  // text contains no tags
  const tagConfig = tagStack.cursor !== -1 ? tagStack.tagConfigs[tagStack.cursor] : undefined;

  // Here raw text is any kind other than normal and void, including escapable_raw_text: its content has no tags. Unlike
  // TagParsingConfig.isRawText, which excludes escapable_raw_text, since parsers decode its text.
  let enclosingRawTextTagConfig =
    tagConfig === undefined || tagConfig.kind === 'normal' || tagConfig.kind === 'void' ? undefined : tagConfig;

  // V8 checks a boolean faster than an object or undefined
  let isEnclosingRawTextTag = enclosingRawTextTagConfig !== undefined;

  // `true` while a void start tag is read, so its closing also ends it
  let isStartTagVoid = scope === SCOPE_START_TAG && tagConfig?.kind === 'void';

  // Skip the pending text, scanned with the previous chunk
  let index = textStartIndex + state.scannedLength;

  // The index of the end tag that ends the enclosing script data
  let scriptDataEndIndex = -1;

  // Whether an end tag ends script data depends on all script data before it, so rescan it from the start
  if (scope !== SCOPE_START_TAG && enclosingRawTextTagConfig?.kind === 'script_data') {
    index = scriptDataEndIndex = getScriptDataEndIndex(
      input,
      textStartIndex,
      enclosingRawTextTagConfig.tagName,
      areSubstringsEqual
    );
  }

  // Each branch continues the loop after its token, or after a "<" that is text, and only the loop start searches for
  // the next "<", so V8 inlines that search once. Conditions compare the char code first, which rules out most branches
  // before context options are read. A token that can continue in the next chunk breaks the loop at its start, before
  // anything is passed to the handler.

  // Where the token being read starts, so reading can stop there
  let tokenStartIndex: number;

  nextToken: while (true) {
    tokenStartIndex = index;

    if (tokenStartIndex >= inputLength) {
      break;
    }

    let charCode = input.charCodeAt(index);

    // One iteration reads the text before a start tag, its name, attributes and closing. Reading resumes inside a start
    // tag only if the previous chunk ended there.
    if (scope !== SCOPE_START_TAG) {
      // ----------------------------------------------------------
      // Skip to the next tag
      // ----------------------------------------------------------

      // Text ends the prologue, and the tag after it is read in the same iteration
      if (charCode !== /* < */ 60) {
        scope = SCOPE_TEXT;

        // Text is often a single char, so the next char is checked before indexOf is called
        tokenStartIndex = index =
          getCharCodeAt(input, index + 1) === /* < */ 60 ? index + 1 : getIndexOfOrLength(input, '<', index + 1);

        if (tokenStartIndex === inputLength) {
          break;
        }
      }

      // Skip "<"
      ++index;

      charCode = getCharCodeAt(input, index);

      // ----------------------------------------------------------
      // End tag
      // ----------------------------------------------------------

      if (charCode === /* / */ 47) {
        // Skip "/"
        const tagNameStartIndex = ++index;

        // The name is read here rather than by skipName, so the char after it is carried in charCode, not read again
        charCode = getCharCodeAt(input, index);

        if (isXMLNameStartChar(charCode)) {
          while (true) {
            if (++index === inputLength) {
              charCode = -1;
              break;
            }

            charCode = input.charCodeAt(index);

            if (isStrict ? !isXMLNameChar(charCode) : !isHTMLNameChar(charCode)) {
              break;
            }
          }
        }

        // The name can continue in the next chunk
        if (index === openEndIndex) {
          break;
        }

        const tagNameEndIndex = index;

        // No tag name
        if (tagNameStartIndex === tagNameEndIndex) {
          if (isStrict) {
            throw new MarkupSyntaxError(
              'Expected a name for the end tag.',
              input,
              tagNameStartIndex,
              tagNameStartIndex + 1
            );
          }

          // "</" is text inside raw text and at the end of the input
          if (isEnclosingRawTextTag || index === inputLength) {
            continue;
          }

          const commentEndIndex = skipUntilTagClosing(input, index);

          // ">" can be in the next chunk
          if (commentEndIndex === openEndIndex) {
            break;
          }

          if (textStartIndex !== tokenStartIndex) {
            handler.onText?.(input, textStartIndex, tokenStartIndex, false);
          }

          // "</>" is ignored, and anything else is a bogus comment, like "#" in "</#>"
          if (commentEndIndex !== index) {
            handler.onComment?.(input, index, commentEndIndex);
          }

          // Skip ">"
          index = commentEndIndex + 1;
          textStartIndex = index = scope === SCOPE_PROLOGUE ? skipSpaces(input, index) : index;
          continue;
        }

        // Inside raw text only the end tag of the raw text tag counts. The end tag of script data was found in advance.
        if (
          isEnclosingRawTextTag &&
          tokenStartIndex !== scriptDataEndIndex &&
          !isRawTextTagNameAt(input, tagNameStartIndex, enclosingRawTextTagConfig!.tagName, areSubstringsEqual)
        ) {
          // Rescan the name as text, since it can contain the real end tag, like in "</a</script>"
          index = tagNameStartIndex;
          continue;
        }

        // Any chars up to ">" are skipped, or only spaces if strict. Usually ">" follows the name, which saves a call.
        const tagClosingIndex =
          charCode === /* > */ 62 ? index : isStrict ? skipSpaces(input, index) : getIndexOfOrLength(input, '>', index);

        // ">" can be in the next chunk
        if (tagClosingIndex === openEndIndex) {
          break;
        }

        // An end tag ends the prologue
        scope = SCOPE_TEXT;

        if (textStartIndex !== tokenStartIndex) {
          // Only the end tag of the enclosing raw text tag gets here inside raw text, so the text before it is the
          // raw text content. isRawText excludes escapable_raw_text, since parsers decode its text.
          handler.onText?.(input, textStartIndex, tokenStartIndex, enclosingRawTextTagConfig?.isRawText === true);
        }

        const tagStackCursor = tagStack.cursor;

        // Fast path: the end tag matches the innermost tag, which was started in this chunk. An empty stack (cursor -1)
        // fails the first check too, so balanceEndTag handles it. End tag names aren't hashed while read, so all chars
        // are compared.
        if (
          tagStackCursor >= tagStack.previousChunkTagCount &&
          areSubstringsEqual(
            input,
            tagStack.tagNameStartIndices[tagStackCursor],
            tagStack.tagNameEndIndices[tagStackCursor],
            input,
            tagNameStartIndex,
            tagNameEndIndex
          )
        ) {
          handler.onEndTagName?.(input, tagNameStartIndex, tagNameEndIndex);

          // popTag written inline, since V8 doesn't inline it on this hot path. Other pops are rarer and stay calls.
          // The tag is from this chunk, so previousChunkTagCount stays.
          tagStack.cursor = tagStackCursor - 1;

          if (tagStackCursor < tagStack.countedTagCount) {
            tagStack.countedTagCount = tagStackCursor;
            --tagStack.enclosingTagHashCodeCounts[tagStack.tagHashCodes[tagStackCursor] & ENCLOSING_TAG_HASH_CODE_MASK];
          }

          tagStack.enclosingGroupBits = tagStack.outerGroupBits[tagStackCursor];

          const tagConfig = tagStack.tagConfigs[tagStackCursor];

          if (tagConfig?.foreignContext !== undefined) {
            tagStack.context = tagStack.outerContexts.pop()!;
          }
        } else {
          balanceEndTag(tagStack, handler, config, input, tagNameStartIndex, tagNameEndIndex);
        }

        // End the raw text tag
        enclosingRawTextTagConfig = undefined;
        isEnclosingRawTextTag = false;

        if (isStrict && getCharCodeAt(input, tagClosingIndex) !== /* > */ 62) {
          throw new MarkupSyntaxError(
            "Expected a closing angle bracket ('>').",
            input,
            tagClosingIndex,
            tagClosingIndex + 1
          );
        }

        // Skip ">"
        textStartIndex = index = tagClosingIndex + 1;
        continue;
      }

      // Raw text has no tokens other than its end tag, which is read above
      if (isEnclosingRawTextTag) {
        // "<" at the end of the input can be followed by the end tag in the next chunk
        if (index === openEndIndex) {
          break;
        }
        continue;
      }

      // ----------------------------------------------------------
      // Processing instruction
      // ----------------------------------------------------------

      if (charCode === /* ? */ 63 && tagStack.context.areProcessingInstructionsRecognized) {
        // Skip "?"
        const targetStartIndex = index + 1;
        const targetEndIndex = skipName(input, targetStartIndex);

        // https://www.w3.org/TR/xml/#sec-pi
        const dataStartIndex = skipSpaces(input, targetEndIndex);
        const dataEndIndex = getIndexOfOrLength(input, '?>', dataStartIndex);

        // "?>" can be in the next chunk
        if (dataEndIndex === openEndIndex) {
          break;
        }

        if (textStartIndex !== tokenStartIndex) {
          handler.onText?.(input, textStartIndex, tokenStartIndex, false);
        }

        // No target
        if (isStrict && targetStartIndex === targetEndIndex) {
          throw new MarkupSyntaxError(
            'Expected a processing instruction target.',
            input,
            targetStartIndex,
            targetStartIndex + 1
          );
        }

        if (isStrict && dataEndIndex === inputLength) {
          throw new MarkupSyntaxError(
            "Expected the processing instruction to be closed with '?>'.",
            input,
            tokenStartIndex,
            inputLength
          );
        }

        handler.onProcessingInstruction?.(input, targetStartIndex, targetEndIndex, dataStartIndex, dataEndIndex);

        // Skip "?>"
        index = dataEndIndex + 2;
        textStartIndex = index = scope === SCOPE_PROLOGUE ? skipSpaces(input, index) : index;
        continue;
      }

      // ----------------------------------------------------------
      // DOCTYPE
      // ----------------------------------------------------------

      // The char is checked first, so the call isn't made at the first tag of every document: with short documents V8
      // would inline it in place of hotter calls
      if (
        charCode === /* ! */ 33 &&
        scope === SCOPE_PROLOGUE &&
        isCaseInsensitiveSubstringAt(input, index, '!doctype')
      ) {
        // Skip "!DOCTYPE"
        const doctypeNameStartIndex = skipSpaces(input, index + 8);
        const doctypeNameEndIndex = skipName(input, doctypeNameStartIndex);
        const doctypeClosingIndex = skipUntilTagClosing(input, doctypeNameEndIndex);

        // ">" can be in the next chunk
        if (doctypeClosingIndex === openEndIndex) {
          break;
        }

        handler.onDoctypeName?.(input, doctypeNameStartIndex, doctypeNameEndIndex);

        // Skip ">"
        textStartIndex = index = skipSpaces(input, doctypeClosingIndex + 1);
        continue;
      }

      // ----------------------------------------------------------
      // CDATA section
      // ----------------------------------------------------------

      if (
        charCode === /* ! */ 33 &&
        tagStack.context.areCDATASectionsRecognized &&
        isCDATASectionOpening(input, index, isStrict)
      ) {
        // Skip "![CDATA["
        const cdataSectionStartIndex = index + 8;
        const cdataSectionEndIndex = getIndexOfOrLength(input, ']]>', cdataSectionStartIndex);

        // "]]>" can be in the next chunk
        if (cdataSectionEndIndex === openEndIndex) {
          break;
        }

        if (textStartIndex !== tokenStartIndex) {
          handler.onText?.(input, textStartIndex, tokenStartIndex, false);
        }

        if (isStrict && cdataSectionEndIndex === inputLength) {
          throw new MarkupSyntaxError(
            "Expected the CDATA section to be closed with ']]>'.",
            input,
            tokenStartIndex,
            inputLength
          );
        }

        handler.onCDATASection?.(input, cdataSectionStartIndex, cdataSectionEndIndex);

        scope = SCOPE_TEXT;

        // Skip "]]>"
        textStartIndex = index = cdataSectionEndIndex + 3;
        continue;
      }

      // ----------------------------------------------------------
      // Comment
      // ----------------------------------------------------------

      if (
        charCode === /* ! */ 33 &&
        index + 2 < inputLength &&
        input.charCodeAt(index + 1) === /* - */ 45 &&
        input.charCodeAt(index + 2) === /* - */ 45
      ) {
        // Skip "!--"
        const commentStartIndex = index + 3;

        const commentEndIndex = isStrict
          ? getIndexOfOrLength(input, '-->', commentStartIndex)
          : getHTMLCommentEndIndex(input, commentStartIndex);

        // The closing ends at the first ">" after the content, or at the input end if the comment isn't closed
        const commentClosingIndex = skipUntilTagClosing(input, commentEndIndex);

        // The comment closing can be in the next chunk
        if (commentClosingIndex === openEndIndex) {
          break;
        }

        if (textStartIndex !== tokenStartIndex) {
          handler.onText?.(input, textStartIndex, tokenStartIndex, false);
        }

        if (isStrict && commentEndIndex === inputLength) {
          throw new MarkupSyntaxError(
            "Expected the comment to be closed with '-->'.",
            input,
            tokenStartIndex,
            inputLength
          );
        }

        handler.onComment?.(input, commentStartIndex, commentEndIndex);

        // Skip ">"
        index = commentClosingIndex + 1;
        textStartIndex = index = scope === SCOPE_PROLOGUE ? skipSpaces(input, index) : index;
        continue;
      }

      // ----------------------------------------------------------
      // Bogus comment
      // ----------------------------------------------------------

      // https://html.spec.whatwg.org/multipage/parsing.html#bogus-comment-state

      if (charCode === /* ? */ 63 || charCode === /* ! */ 33) {
        const commentEndIndex = skipUntilTagClosing(input, index);

        // ">" can be in the next chunk, and so can the rest of a comment, a CDATA section or a DOCTYPE opening
        if (commentEndIndex === openEndIndex) {
          break;
        }

        if (textStartIndex !== tokenStartIndex) {
          handler.onText?.(input, textStartIndex, tokenStartIndex, false);
        }

        if (isStrict) {
          throw new MarkupSyntaxError(
            charCode === /* ? */ 63
              ? 'Processing instructions are forbidden.'
              : "Expected a comment ('<!--')" +
                  (isFragment || scope !== SCOPE_PROLOGUE ? '' : ", a doctype declaration ('<!DOCTYPE')") +
                  (tagStack.context.areCDATASectionsRecognized ? ", or a CDATA section ('<![CDATA[')" : '') +
                  '.',
            input,
            index - 1,
            index + 1
          );
        }

        // Skip "!", unlike "?" it isn't a part of the comment
        if (charCode === /* ! */ 33) {
          ++index;
        }

        handler.onComment?.(input, index, commentEndIndex);

        // Skip ">"
        index = commentEndIndex + 1;
        textStartIndex = index = scope === SCOPE_PROLOGUE ? skipSpaces(input, index) : index;
        continue;
      }

      // ----------------------------------------------------------
      // Start tag
      // ----------------------------------------------------------

      const tagNameStartIndex = index;

      // The name is hashed while it's read, rather than read again by config.getSubstringHashCode, which gives the same
      // hash. Keep in sync with getCaseInsensitiveHashCode and getCaseSensitiveHashCode.
      let startTagHashCode = 5_381;

      if (isXMLNameStartChar(charCode)) {
        if (areTagNamesCaseInsensitive && !isStrict) {
          // HTML names have a separate loop, which doesn't check options at every char
          while (true) {
            startTagHashCode = ((startTagHashCode << 5) + startTagHashCode + toLowerCaseCharCode(charCode)) | 0;

            if (++index === inputLength) {
              charCode = -1;
              break;
            }

            charCode = input.charCodeAt(index);

            if (!isHTMLNameChar(charCode)) {
              break;
            }
          }
        } else {
          while (true) {
            startTagHashCode =
              ((startTagHashCode << 5) +
                startTagHashCode +
                (areTagNamesCaseInsensitive ? toLowerCaseCharCode(charCode) : charCode)) |
              0;

            if (++index === inputLength) {
              charCode = -1;
              break;
            }

            charCode = input.charCodeAt(index);

            if (isStrict ? !isXMLNameChar(charCode) : !isHTMLNameChar(charCode)) {
              break;
            }
          }
        }
      }

      startTagHashCode &= 0x3fffffff;

      // The name can continue in the next chunk
      if (index === openEndIndex) {
        break;
      }

      const tagNameEndIndex = index;

      // No tag name
      if (tagNameStartIndex === tagNameEndIndex) {
        if (isStrict) {
          throw new MarkupSyntaxError(
            'Expected a name for the start tag.',
            input,
            tagNameStartIndex,
            tagNameStartIndex + 1
          );
        }

        // "<" is text, which ends the prologue
        scope = SCOPE_TEXT;
        continue;
      }

      if (textStartIndex !== tokenStartIndex) {
        handler.onText?.(input, textStartIndex, tokenStartIndex, false);
      }

      // getTagConfig written inline, since it doesn't fit into the inlining budget of readTokens. Keep them in sync.
      let startTagConfig: TagParsingConfig | undefined;

      const tagConfigTable = tagStack.context.tagConfigTable;
      const indexMask = tagConfigTable.length - 1;

      let tagConfigIndex = startTagHashCode & indexMask;

      // An empty slot ends the lookup
      while ((startTagConfig = tagConfigTable[tagConfigIndex]) !== undefined) {
        if (
          startTagConfig.tagHashCode === startTagHashCode &&
          areSubstringsEqual(
            startTagConfig.tagName,
            0,
            startTagConfig.tagName.length - 1,
            input,
            tagNameStartIndex,
            tagNameEndIndex - 1
          )
        ) {
          break;
        }
        tagConfigIndex = (tagConfigIndex + 1) & indexMask;
      }

      // Group bits show whether the tag can end any enclosing tag, which is rare, so the stack is usually not searched
      if (startTagConfig !== undefined && (tagStack.enclosingGroupBits & startTagConfig.endedGroupBits) !== 0) {
        startTagConfig = insertImplicitEndTagsBeforeStartTag(
          tagStack,
          handler,
          startTagConfig,
          input,
          tagNameStartIndex,
          tagNameEndIndex,
          areSubstringsEqual
        );
      }

      if (isStrict && !isFragment && tagStack.cursor === -1) {
        if (tagStack.isRootElementRead) {
          throw new MarkupSyntaxError('Expected a single root element.', input, tokenStartIndex, tagNameEndIndex);
        }
        tagStack.isRootElementRead = true;
      }

      handler.onStartTagName?.(input, tagNameStartIndex, tagNameEndIndex);

      // Push written inline, since a push function would compete for the inlining budget of readTokens and stay a call
      const tagStackCursor = ++tagStack.cursor;

      tagStack.tagNameStartIndices[tagStackCursor] = tagNameStartIndex;
      tagStack.tagNameEndIndices[tagStackCursor] = tagNameEndIndex;
      tagStack.tagHashCodes[tagStackCursor] = startTagHashCode;
      tagStack.tagConfigs[tagStackCursor] = startTagConfig;
      tagStack.outerGroupBits[tagStackCursor] = tagStack.enclosingGroupBits;

      if (startTagConfig !== undefined) {
        tagStack.enclosingGroupBits |= startTagConfig.groupBit;

        if (startTagConfig.foreignContext !== undefined) {
          tagStack.outerContexts.push(tagStack.context);
          tagStack.context = startTagConfig.foreignContext;
        }
      }

      isStartTagVoid = false;

      // Most tags are normal, so one comparison skips the rest
      if (startTagConfig !== undefined && startTagConfig.kind !== 'normal') {
        isStartTagVoid = startTagConfig.kind === 'void';

        // Start of a raw text tag of any kind
        if (!isStartTagVoid) {
          enclosingRawTextTagConfig = startTagConfig;
          isEnclosingRawTextTag = true;
        }
      }

      scope = SCOPE_START_TAG;
    }

    // ----------------------------------------------------------
    // Attributes and the closing of a start tag
    // ----------------------------------------------------------

    // charCode holds the char at index: carried from the name loop or the previous iteration, or read at the loop start
    // on resume
    while (true) {
      tokenStartIndex = index;

      if (tokenStartIndex >= inputLength) {
        break nextToken;
      }

      // Spaces are skipped here, in one place, rather than after the tag name and after each attribute
      if (isSpaceChar(charCode)) {
        charCode = getCharCodeAt(input, ++index);
        continue;
      }

      // ----------------------------------------------------------
      // Self-closing start tag
      // ----------------------------------------------------------

      if (charCode === /* / */ 47 && tagStack.context.areSelfClosingTagsRecognized) {
        if (getCharCodeAt(input, tokenStartIndex + 1) === /* > */ 62) {
          // Skip "/>"
          index += 2;

          handler.onStartTagSelfClosing?.(input, tokenStartIndex, index);

          popTag(tagStack);

          // Self-closing raw text tag has no content
          enclosingRawTextTagConfig = undefined;
          isEnclosingRawTextTag = false;

          scope = SCOPE_TEXT;
          textStartIndex = index;
          continue nextToken;
        }

        // ">" can be in the next chunk
        if (tokenStartIndex + 1 === openEndIndex) {
          break nextToken;
        }
      }

      // ----------------------------------------------------------
      // Closing of a start tag
      // ----------------------------------------------------------

      if (charCode === /* > */ 62) {
        // Skip ">"
        ++index;

        handler.onStartTagClosing?.(input, tokenStartIndex, index);

        // A void tag is ended right after its start tag
        if (isStartTagVoid) {
          handler.onEndTagName?.(input, index, index);
          popTag(tagStack);
        }

        scope = SCOPE_TEXT;
        textStartIndex = index;

        // Script data can contain end tags that don't end it, so the one that does is found in advance
        if (enclosingRawTextTagConfig?.kind === 'script_data') {
          index = scriptDataEndIndex = getScriptDataEndIndex(
            input,
            index,
            enclosingRawTextTagConfig.tagName,
            areSubstringsEqual
          );
        }
        continue nextToken;
      }

      // ----------------------------------------------------------
      // Attribute
      // ----------------------------------------------------------

      // The name is read here rather than by a skip function, so the char after it is carried in charCode
      if (isStrict ? isXMLNameStartChar(charCode) : isHTMLAttributeNameChar(charCode)) {
        while (true) {
          if (++index === inputLength) {
            charCode = -1;
            break;
          }

          charCode = input.charCodeAt(index);

          if (isStrict ? !isXMLNameChar(charCode) : !isHTMLAttributeNameChar(charCode)) {
            break;
          }
        }
      }

      // No attribute name
      if (index === tokenStartIndex) {
        // Skip the invalid char
        if (!isStrict) {
          charCode = getCharCodeAt(input, ++index);
          continue;
        }

        throw new MarkupSyntaxError(
          'Expected an attribute name' +
            (tagStack.context.areSelfClosingTagsRecognized ? ", a self-closing start tag ('/>')," : '') +
            " or a start tag closing ('>').",
          input,
          tokenStartIndex,
          tokenStartIndex + 1
        );
      }

      // The name is passed to the handler only with the value, since the value can be in the next chunk
      const attributeNameEndIndex = index;

      // Spaces around "=" are rare, so skipSpaces is called only if there is one
      if (isSpaceChar(charCode)) {
        index = skipSpaces(input, index + 1);
        charCode = getCharCodeAt(input, index);
      }

      // No attribute value
      if (charCode !== /* = */ 61) {
        // The name or "=" can be in the next chunk
        if (index === openEndIndex) {
          break nextToken;
        }

        if (isStrict) {
          throw new MarkupSyntaxError(
            "Expected an attribute value separated by an equals sign ('=').",
            input,
            index,
            index + 1
          );
        }

        handler.onAttribute?.(input, tokenStartIndex, attributeNameEndIndex, index, index);
        continue;
      }

      // Skip "="
      ++index;

      let quoteCharCode = getCharCodeAt(input, index);

      if (isSpaceChar(quoteCharCode)) {
        index = skipSpaces(input, index + 1);
        quoteCharCode = getCharCodeAt(input, index);
      }

      // ----------------------------------------------------------
      // Unquoted attribute value
      // ----------------------------------------------------------

      if (quoteCharCode !== /* " */ 34 && quoteCharCode !== /* ' */ 39) {
        const attributeValueEndIndex = skipUnquotedAttributeValue(input, index);

        // The value, or its opening quote char, can be in the next chunk
        if (attributeValueEndIndex === openEndIndex) {
          break nextToken;
        }

        if (isStrict) {
          throw new MarkupSyntaxError(
            'Expected a double-quoted (\'"\') or a single-quoted ("\'") attribute value.',
            input,
            index,
            index + 1
          );
        }

        handler.onAttribute?.(input, tokenStartIndex, attributeNameEndIndex, index, attributeValueEndIndex);

        index = attributeValueEndIndex;
        charCode = getCharCodeAt(input, index);
        continue;
      }

      // ----------------------------------------------------------
      // Quoted attribute value
      // ----------------------------------------------------------

      // Skip opening quote char
      const attributeValueStartIndex = ++index;

      index = getIndexOfOrLength(input, quoteCharCode === /* " */ 34 ? '"' : "'", index);

      // The closing quote char can be in the next chunk
      if (index === openEndIndex) {
        break nextToken;
      }

      if (isStrict && index === inputLength) {
        throw new MarkupSyntaxError(
          quoteCharCode === /* " */ 34
            ? "Expected the attribute value to be closed with a double-quote ('\"')."
            : 'Expected the attribute value to be closed with a single-quote ("\'").',
          input,
          attributeValueStartIndex,
          inputLength
        );
      }

      handler.onAttribute?.(input, tokenStartIndex, attributeNameEndIndex, attributeValueStartIndex, index);

      // Skip closing quote char
      charCode = getCharCodeAt(input, ++index);
    }
  }

  state.scope = scope;

  if (isInputEnded) {
    // Trailing text, unless the input ended inside a start tag
    if (scope !== SCOPE_START_TAG && textStartIndex < inputLength) {
      handler.onText?.(input, textStartIndex, inputLength, enclosingRawTextTagConfig?.isRawText === true);
    }
    return inputLength;
  }

  // Text before the token can continue in the next chunk, so it's held back as pending text that isn't scanned again
  const resumeIndex = scope !== SCOPE_START_TAG && textStartIndex < tokenStartIndex ? textStartIndex : tokenStartIndex;

  state.scannedLength = tokenStartIndex - resumeIndex;

  return resumeIndex;
}

/**
 * Returns `true` if the name of a raw text tag starts at index and is followed by a space, `/` or `>`. Only such an end
 * tag ends raw text, so `</script` at the end of the input, or `</scripts>`, is text.
 *
 * @param input The text to check.
 * @param index The index in the input where the name is expected.
 * @param tagName The name of the raw text tag.
 * @param areSubstringsEqual Compares all chars, since hash codes aren't known here.
 */
const isRawTextTagNameAt = (
  input: string,
  index: number,
  tagName: string,
  areSubstringsEqual: SubstringComparer
): boolean => {
  const endIndex = index + tagName.length;
  const charCode = getCharCodeAt(input, endIndex);

  return (
    (isSpaceChar(charCode) || charCode === /* / */ 47 || charCode === /* > */ 62) &&
    areSubstringsEqual(tagName, 0, tagName.length, input, index, endIndex)
  );
};

/**
 * Returns the index of the end tag that ends script data, or the input length if there's none.
 *
 * After `<!--` script data is escaped, and a start tag with the script tag's name makes it double escaped. In double
 * escaped data an end tag of that name only returns to escaped, and `-->` ends escaping.
 *
 * @param input The text to scan.
 * @param index The index in the input where script data starts.
 * @param tagName The name of the script data tag.
 * @param areSubstringsEqual Compares all chars, since hash codes aren't known here.
 * @see [HTML Script Data State](https://html.spec.whatwg.org/multipage/parsing.html#script-data-state)
 */
const getScriptDataEndIndex = (
  input: string,
  index: number,
  tagName: string,
  areSubstringsEqual: SubstringComparer
): number => {
  // Most "<" in script data aren't followed by the tag name, so its first char is compared before the whole name.
  // Ignoring case here also works for case-sensitive names, since this only filters.
  const tagNameCharCode = toLowerCaseCharCode(tagName.charCodeAt(0));

  let isEscaped = false;
  let isDoubleEscaped = false;

  // The "-->" that ends escaping, searched for once per "<!--"
  let commentClosingIndex = 0;

  while (true) {
    const tagOpeningIndex = skipUntilTagOpening(input, index);

    // "-->" before the tag opening ends escaping
    if (isEscaped && commentClosingIndex < tagOpeningIndex) {
      isEscaped = false;
      isDoubleEscaped = false;
    }

    // There's no tag opening, or the input ends with it
    if (tagOpeningIndex + 1 >= input.length) {
      return input.length;
    }

    // Skip "<"
    index = tagOpeningIndex + 1;

    if (input.charCodeAt(index) === /* / */ 47) {
      if (
        index + 1 < input.length &&
        toLowerCaseCharCode(input.charCodeAt(index + 1)) === tagNameCharCode &&
        isRawTextTagNameAt(input, index + 1, tagName, areSubstringsEqual)
      ) {
        if (!isDoubleEscaped) {
          return tagOpeningIndex;
        }
        isDoubleEscaped = false;
      }
      continue;
    }

    if (!isEscaped) {
      if (
        index + 2 < input.length &&
        input.charCodeAt(index) === /* ! */ 33 &&
        input.charCodeAt(index + 1) === /* - */ 45 &&
        input.charCodeAt(index + 2) === /* - */ 45
      ) {
        isEscaped = true;

        // Dashes of "<!--" can be a part of "-->", so "<!-->" doesn't escape anything
        commentClosingIndex = getIndexOfOrLength(input, '-->', index + 1);
      }
      continue;
    }

    if (
      toLowerCaseCharCode(input.charCodeAt(index)) === tagNameCharCode &&
      isRawTextTagNameAt(input, index, tagName, areSubstringsEqual)
    ) {
      isDoubleEscaped = true;
    }
  }
};

/**
 * Returns the index where the content of an HTML comment ends. `-->` and `--!>` close a comment, and `<!-->` and
 * `<!--->` are empty. An unclosed comment ends with the input, except for a trailing `-`, `--` or `--!`.
 *
 * @param input The text to scan.
 * @param index The index in the input where the content starts, after `<!--`.
 * @see [HTML Comment Start State](https://html.spec.whatwg.org/multipage/parsing.html#comment-start-state)
 */
const getHTMLCommentEndIndex = (input: string, index: number): number => {
  // "<!-->"
  if (index < input.length && input.charCodeAt(index) === /* > */ 62) {
    return index;
  }

  // "<!--->"
  if (
    index + 1 < input.length &&
    input.charCodeAt(index) === /* - */ 45 &&
    input.charCodeAt(index + 1) === /* > */ 62
  ) {
    return index;
  }

  const contentStartIndex = index;

  while (true) {
    index = input.indexOf('--', index);

    if (index === -1) {
      // The comment isn't closed, but a trailing dash can start a comment closing
      if (input.length > contentStartIndex && input.charCodeAt(input.length - 1) === /* - */ 45) {
        return input.length - 1;
      }
      return input.length;
    }

    // The comment closing starts with the last two dashes in a row, like in "--->"
    while (index + 2 < input.length && input.charCodeAt(index + 2) === /* - */ 45) {
      ++index;
    }

    // The comment isn't closed, and ends with "--"
    if (index + 2 === input.length) {
      return index;
    }

    const charCode = input.charCodeAt(index + 2);

    // "-->", "--!>", or the comment isn't closed and ends with "--!"
    if (
      charCode === /* > */ 62 ||
      (charCode === /* ! */ 33 && (index + 3 === input.length || input.charCodeAt(index + 3) === /* > */ 62))
    ) {
      return index;
    }

    // Skip "--" that isn't a comment closing
    index += 2;
  }
};

/**
 * Returns the char code at index, or -1 past the end of the input.
 */
const getCharCodeAt = (input: string, index: number): number => {
  return index < input.length ? input.charCodeAt(index) : -1;
};

const getIndexOfOrLength = (input: string, searchString: string, index: number): number => {
  index = input.indexOf(searchString, index);

  return index !== -1 ? index : input.length;
};

/**
 * Returns `true` if `![CDATA[` starts at index, ignoring case unless `isCaseSensitive`.
 */
const isCDATASectionOpening = (input: string, index: number, isCaseSensitive: boolean): boolean => {
  return isCaseSensitive ? input.startsWith('![CDATA[', index) : isCaseInsensitiveSubstringAt(input, index, '![cdata[');
};

/**
 * Returns `true` if a lower case prefix starts at index, ignoring the case of ASCII letters in the input.
 */
const isCaseInsensitiveSubstringAt = (input: string, index: number, lowerCasePrefix: string): boolean => {
  if (index + lowerCasePrefix.length > input.length) {
    return false;
  }

  for (let i = 0; i < lowerCasePrefix.length; ++i) {
    if (toLowerCaseCharCode(input.charCodeAt(index + i)) !== lowerCasePrefix.charCodeAt(i)) {
      return false;
    }
  }
  return true;
};

// ----------------------------------------------------------
// Check chars
// ----------------------------------------------------------

// Flags of ASCII chars in asciiCharFlags
const CHAR_FLAG_SPACE = 1 << 0;
const CHAR_FLAG_HTML_NAME_END = 1 << 1;
const CHAR_FLAG_HTML_ATTRIBUTE_NAME_END = 1 << 2;
const CHAR_FLAG_UNQUOTED_ATTRIBUTE_VALUE_END = 1 << 3;
const CHAR_FLAG_XML_NAME_START = 1 << 4;
const CHAR_FLAG_XML_NAME = 1 << 5;

// Flags by ASCII char code. A predicate that reads one flag fits into 30 bytes of bytecode, so V8 inlines it into
// readTokens without spending the inlining budget. Other char codes, including -1, read undefined, which has no flags.
const asciiCharFlags = new Uint8Array(128);

for (let charCode = 0; charCode < 128; ++charCode) {
  // https://www.w3.org/TR/xml/#NT-S
  const isSpace =
    charCode === /* \s */ 32 || charCode === /* \n */ 10 || charCode === /* \t */ 9 || charCode === /* \r */ 13;

  // https://www.w3.org/TR/xml/#NT-NameStartChar
  const isXMLNameStart =
    (charCode >= /* a */ 97 && charCode <= /* z */ 122) ||
    (charCode >= /* A */ 65 && charCode <= /* Z */ 90) ||
    charCode === /* _ */ 95 ||
    charCode === /* : */ 58;

  // https://www.w3.org/TR/xml/#NT-NameChar
  const isXMLName =
    isXMLNameStart ||
    (charCode >= /* 0 */ 48 && charCode <= /* 9 */ 57) ||
    charCode === /* - */ 45 ||
    charCode === /* . */ 46;

  asciiCharFlags[charCode] =
    (isSpace ? CHAR_FLAG_SPACE : 0) |
    (isSpace || charCode === /* / */ 47 || charCode === /* > */ 62 ? CHAR_FLAG_HTML_NAME_END : 0) |
    (isSpace || charCode === /* / */ 47 || charCode === /* > */ 62 || charCode === /* = */ 61
      ? CHAR_FLAG_HTML_ATTRIBUTE_NAME_END
      : 0) |
    // https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(unquoted)-state
    (isSpace || charCode === /* > */ 62 ? CHAR_FLAG_UNQUOTED_ATTRIBUTE_VALUE_END : 0) |
    (isXMLNameStart ? CHAR_FLAG_XML_NAME_START : 0) |
    (isXMLName ? CHAR_FLAG_XML_NAME : 0);
}

const isSpaceChar = (charCode: number): boolean => {
  return (asciiCharFlags[charCode] & CHAR_FLAG_SPACE) !== 0;
};

const isXMLNameStartChar = (charCode: number): boolean => {
  // Most names are ASCII, so other chars are checked in a separate function
  return charCode < 0x80
    ? (asciiCharFlags[charCode] & CHAR_FLAG_XML_NAME_START) !== 0
    : isXMLNameStartCharAboveASCII(charCode);
};

const isXMLNameStartCharAboveASCII = (charCode: number): boolean => {
  return (
    (charCode >= 0x000c0 && charCode <= 0x000d6) ||
    (charCode >= 0x000d8 && charCode <= 0x000f6) ||
    (charCode >= 0x000f8 && charCode <= 0x002ff) ||
    (charCode >= 0x00370 && charCode <= 0x0037d) ||
    (charCode >= 0x0037f && charCode <= 0x01fff) ||
    (charCode >= 0x0200c && charCode <= 0x0200d) ||
    (charCode >= 0x02070 && charCode <= 0x0218f) ||
    (charCode >= 0x02c00 && charCode <= 0x02fef) ||
    (charCode >= 0x03001 && charCode <= 0x0d7ff) ||
    (charCode >= 0x0f900 && charCode <= 0x0fdcf) ||
    (charCode >= 0x0fdf0 && charCode <= 0x0fffd) ||
    (charCode >= 0x10000 && charCode <= 0xeffff)
  );
};

const isXMLNameChar = (charCode: number): boolean => {
  return charCode < 0x80 ? (asciiCharFlags[charCode] & CHAR_FLAG_XML_NAME) !== 0 : isXMLNameCharAboveASCII(charCode);
};

const isXMLNameCharAboveASCII = (charCode: number): boolean => {
  return (
    isXMLNameStartCharAboveASCII(charCode) ||
    charCode === 0xb7 ||
    (charCode >= 0x0300 && charCode <= 0x036f) ||
    (charCode >= 0x203f && charCode <= 0x2040)
  );
};

// Chars that end HTML names and unquoted values are ASCII, so all other chars are accepted, and so is -1 (the end of the
// input from getCharCodeAt): callers check the input end first

const isHTMLNameChar = (charCode: number): boolean => {
  return (asciiCharFlags[charCode] & CHAR_FLAG_HTML_NAME_END) === 0;
};

const isHTMLAttributeNameChar = (charCode: number): boolean => {
  return (asciiCharFlags[charCode] & CHAR_FLAG_HTML_ATTRIBUTE_NAME_END) === 0;
};

const isUnquotedAttributeValueChar = (charCode: number): boolean => {
  return (asciiCharFlags[charCode] & CHAR_FLAG_UNQUOTED_ATTRIBUTE_VALUE_END) === 0;
};

// ----------------------------------------------------------
// Skip char sequences
// ----------------------------------------------------------

// Each skip function has its own loop, since V8 doesn't inline a char predicate passed as an argument

const skipSpaces = (input: string, index: number): number => {
  while (index < input.length && isSpaceChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
};

// https://www.w3.org/TR/xml/#NT-Name
const skipXMLName = (input: string, index: number): number => {
  if (!isXMLNameStartChar(getCharCodeAt(input, index))) {
    return index;
  }

  // Skip the start char
  ++index;

  while (index < input.length && isXMLNameChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
};

const skipHTMLName = (input: string, index: number): number => {
  if (!isXMLNameStartChar(getCharCodeAt(input, index))) {
    return index;
  }

  // Skip the start char
  ++index;

  while (index < input.length && isHTMLNameChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
};

const skipUnquotedAttributeValue = (input: string, index: number): number => {
  while (index < input.length && isUnquotedAttributeValueChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
};

// Tags are often adjacent or one char apart, and ">" usually follows an end tag name, so the nearest chars are checked
// before indexOf is called, which costs more than a few comparisons

const skipUntilTagOpening = (input: string, index: number): number => {
  if (index + 1 < input.length) {
    if (input.charCodeAt(index) === /* < */ 60) {
      return index;
    }
    if (input.charCodeAt(index + 1) === /* < */ 60) {
      return index + 1;
    }
  }
  return getIndexOfOrLength(input, '<', index);
};

const skipUntilTagClosing = (input: string, index: number): number => {
  if (index < input.length && input.charCodeAt(index) === /* > */ 62) {
    return index;
  }
  return getIndexOfOrLength(input, '>', index);
};
