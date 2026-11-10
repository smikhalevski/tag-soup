import { MarkupSyntaxError } from './MarkupSyntaxError.ts';
import type { TagParsingConfig, TokenizerConfig, TokenizerContext } from './resolveTokenizerOptions.ts';
import type { TokenCallback, TokenizerWriter } from './types.ts';
import {
  areCaseInsensitiveSubstringsEqual,
  areCaseSensitiveSubstringsEqual,
  getCaseInsensitiveHashCode,
  getCaseSensitiveHashCode,
  toLowerCaseCharCode,
} from './utils.ts';

/**
 * The state of reading a text, shared with the callback. The config is shared by all calls, so everything that changes
 * during a call is kept here. A writer reads all chunks with the same state, so it also keeps what is needed to continue
 * reading where the previous chunk ended.
 *
 * @see {@link createTokenizerState}
 * @internal
 */
export interface TokenizerState {
  /**
   * The hash code of the start tag name, set before a `start_tag_name` token is passed to a callback, so the callback
   * doesn't have to hash the name again.
   */
  tagHashCode: number;

  /**
   * The config of the start tag, or `undefined` if options don't mention the tag. The tag callback of
   * {@link readTokens} sets it when a `start_tag_name` token is passed to it, so {@link readTokens} and the callback of
   * {@link createTokenizerWriter} don't have to look the tag up again. If there's no tag callback, {@link readTokens}
   * sets it before a `start_tag_name` token is passed to the callback.
   *
   * @see {@link getTagConfig}
   */
  tagConfig: TagParsingConfig | undefined;

  /**
   * The context of the content that is being read. {@link createTokenizerWriter} switches it when a foreign tag
   * is started or ended, and restores the initial context when all foreign tags are ended. {@link readTokens} reads it
   * on every use.
   */
  context: TokenizerContext;

  /**
   * If `false` then more chunks can follow the input, so {@link readTokens} doesn't read tokens that reach the end of
   * the input, since they can continue in the next chunk.
   */
  isInputEnded: boolean;

  /**
   * The scope where reading continues, one of `SCOPE_*` constants.
   */
  scope: number;

  /**
   * The length of text at the start of the input that was read with the previous chunk, and has no tokens, so reading
   * continues after it.
   */
  pendingTextLength: number;

  /**
   * The hash code of the enclosing raw text tag, or 0 if text isn't read inside a raw text tag.
   */
  enclosingRawTextTagHashCode: number;

  /**
   * The text that contains the name of the enclosing raw text tag: the input, or a copy of the name if the tag was
   * started in a previous chunk.
   */
  enclosingRawTextTagNameInput: string;

  /**
   * The index in {@link enclosingRawTextTagNameInput} where the name of the enclosing raw text tag starts.
   */
  enclosingRawTextTagNameStartIndex: number;

  /**
   * The index in {@link enclosingRawTextTagNameInput} where the name of the enclosing raw text tag ends.
   */
  enclosingRawTextTagNameEndIndex: number;

  /**
   * `true` if the enclosing raw text tag contains script data.
   */
  isEnclosingRawTextTagScriptData: boolean;

  /**
   * `true` if the start tag that is being read is void, so its closing is passed to the tag callback of
   * {@link readTokens}.
   */
  isStartTagVoid: boolean;
}

/**
 * Creates the state of reading a text from the start.
 *
 * @param context The context that is applied outside of foreign tags.
 * @internal
 */
export function createTokenizerState(context: TokenizerContext): TokenizerState {
  return {
    tagHashCode: 0,
    tagConfig: undefined,
    context,
    isInputEnded: true,
    scope: SCOPE_INITIAL,
    pendingTextLength: 0,
    enclosingRawTextTagHashCode: 0,
    enclosingRawTextTagNameInput: '',
    enclosingRawTextTagNameStartIndex: 0,
    enclosingRawTextTagNameEndIndex: 0,
    isEnclosingRawTextTagScriptData: false,
    isStartTagVoid: false,
  };
}

/**
 * Creates a writer that reads tokens from chunks of text and returns them by invoking a callback.
 *
 * Tokens are _guaranteed_ to be balanced: each start tag is followed by a matching end tag. Missing tokens are inserted
 * if needed. Foreign tags switch the context for their content.
 *
 * Parameters have no default values, since then V8 creates a separate context for variables that the closures capture,
 * which is slower to create.
 *
 * @param callback The callback that is invoked when a token is read.
 * @param config The tokenizer config prepared by {@link resolveTokenizerOptions}.
 * @param state The state of reading, which is shared with the callback. Its context is applied outside of foreign
 *   tags.
 * @internal
 */
export function createTokenizerWriter(
  callback: TokenCallback,
  config: TokenizerConfig,
  state: TokenizerState
): TokenizerWriter {
  const {
    areTagNamesCaseInsensitive,
    initialEnclosingTagCounts,
    areUnbalancedStartTagsImplicitlyEnded,
    areUnbalancedEndTagsIgnored,
    isFragment,
    isStrict,
  } = config;

  const getTagHashCode = areTagNamesCaseInsensitive ? getCaseInsensitiveHashCode : getCaseSensitiveHashCode;
  const areTagNamesEqual = areTagNamesCaseInsensitive
    ? areCaseInsensitiveSubstringsEqual
    : areCaseSensitiveSubstringsEqual;

  // Positions of start tag names in the input, to compare them with end tag names
  const tagNameStartIndexStack = [0, 0, 0, 0, 0, 0, 0, 0];
  const tagNameEndIndexStack = [0, 0, 0, 0, 0, 0, 0, 0];

  // Hash codes of names of enclosing tags. If an end tag doesn't end the innermost enclosing tag, its start tag is
  // searched for by the hash code, and names are compared only if hash codes are equal.
  const tagHashCodeStack = [0, 0, 0, 0, 0, 0, 0, 0];

  // Names of enclosing tags that were started in previous chunks, since inputs of previous chunks aren't retained.
  // These tags are at the bottom of the stack, below tags that were started in the current chunk.
  const copiedTagNameStack: string[] = [];

  // Configs of enclosing tags, or undefined for tags that options don't mention
  const tagConfigStack: Array<TagParsingConfig | undefined> = [];

  // The number of enclosing tags by the bit of their group ID
  const enclosingTagCounts = initialEnclosingTagCounts.slice();

  // Bits of group IDs of enclosing tags, see TagParsingConfig.implicitlyEndedTagGroupIdMask
  let enclosingTagGroupIdMask = 0;

  // The number of enclosing tags by low bits of the hash code of their name. If the count for the hash code of an end
  // tag is zero, the end tag has no start tag, so enclosing tags aren't searched. Tags with different names can share
  // a count, which costs a search, but doesn't change the result.
  const enclosingTagHashCodeCounts = initialEnclosingTagHashCodeCounts.slice();

  // Contexts that were current when each enclosing foreign tag was started, so they're restored when it ends
  const outerContextStack: TokenizerContext[] = [];

  // The index of the innermost enclosing tag in tag stacks
  let tagStackCursor = -1;

  // The number of enclosing tags that were started in previous chunks
  let copiedTagNameCount = 0;

  let isRootElementRead = false;

  // Text that wasn't read yet, chunks are appended to it
  let unreadInput = '';
  let isEnded = false;

  function popTag(): void {
    // Tags that were started in previous chunks are at the bottom of the stack
    if (tagStackCursor < copiedTagNameCount) {
      copiedTagNameCount = tagStackCursor;
    }

    --enclosingTagHashCodeCounts[tagHashCodeStack[tagStackCursor] & ENCLOSING_TAG_HASH_CODE_MASK];

    const tagConfig = tagConfigStack[tagStackCursor--];

    if (tagConfig !== undefined) {
      const bitIndex = tagConfig.tagGroupIdBitIndex;

      if (bitIndex !== -1 && --enclosingTagCounts[bitIndex] === 0) {
        enclosingTagGroupIdMask &= ~(1 << bitIndex);
      }
      if (tagConfig.foreignContext !== undefined) {
        state.context = outerContextStack.pop()!;
      }
    }
  }

  // Returns the index of the nearest enclosing tag that has the same name as the end tag, or -1 if there's none.
  // Different names can have equal hash codes, so names of tags that have the hash code of the end tag are compared.
  function getStartTagIndex(
    endTagHashCode: number,
    input: string,
    endTagNameStartIndex: number,
    endTagNameEndIndex: number
  ): number {
    // None of the enclosing tags has these low bits of the hash code, so there's nothing to search for
    if (enclosingTagHashCodeCounts[endTagHashCode & ENCLOSING_TAG_HASH_CODE_MASK] === 0) {
      return -1;
    }

    let index = tagStackCursor;

    for (; index >= copiedTagNameCount; --index) {
      if (
        tagHashCodeStack[index] === endTagHashCode &&
        areTagNamesEqual(
          input,
          tagNameStartIndexStack[index],
          tagNameEndIndexStack[index],
          input,
          endTagNameStartIndex,
          endTagNameEndIndex
        )
      ) {
        return index;
      }
    }

    // Tags that were started in previous chunks
    for (; index !== -1; --index) {
      if (tagHashCodeStack[index] !== endTagHashCode) {
        continue;
      }

      const tagName = copiedTagNameStack[index];

      if (areTagNamesEqual(tagName, 0, tagName.length, input, endTagNameStartIndex, endTagNameEndIndex)) {
        return index;
      }
    }
    return -1;
  }

  function insertImplicitEndTags(implicitlyEndedTagGroupIds: number[], insertionIndex: number, input: string): void {
    // Tags outside the nearest boundary aren't ended, unless the boundary itself must be ended
    let index = tagStackCursor;

    while (
      index !== -1 &&
      (!isImplicitEndingBoundary(tagConfigStack[index]) ||
        isImplicitlyEnded(tagConfigStack[index], implicitlyEndedTagGroupIds))
    ) {
      --index;
    }

    // Find the outermost tag that must be ended
    ++index;

    while (index <= tagStackCursor && !isImplicitlyEnded(tagConfigStack[index], implicitlyEndedTagGroupIds)) {
      ++index;
    }

    while (index <= tagStackCursor) {
      callback(TOKEN_KIND_END_TAG_NAME, insertionIndex, insertionIndex, input);
      popTag();
    }
  }

  // Receives only tokens that start and end tags, other tokens are passed to the callback by readTokens
  const tagCallback: TokenCallback = (tokenKind, startIndex, endIndex, input) => {
    // Cases are compared in order, so frequent tokens come first
    switch (tokenKind) {
      case TOKEN_KIND_START_TAG_NAME: {
        // Hashed by readTokens, which reads the config of the tag from the state after this callback
        const startTagHashCode = state.tagHashCode;

        let startTagConfig = getTagConfig(
          state.context,
          startTagHashCode,
          input,
          startIndex,
          endIndex,
          areTagNamesEqual
        );

        // Usually none of the enclosing tags must be ended, so the stack isn't searched
        if (
          startTagConfig !== undefined &&
          (enclosingTagGroupIdMask & startTagConfig.implicitlyEndedTagGroupIdMask) !== 0
        ) {
          insertImplicitEndTags(startTagConfig.implicitlyEndedTagGroupIds, startIndex - 1, input);

          // Ended foreign tags restore the outer context, so the start tag is read with tags of the restored context
          startTagConfig = getTagConfig(state.context, startTagHashCode, input, startIndex, endIndex, areTagNamesEqual);
        }

        // The callback reads the config of the start tag from the state, rather than looking the tag up
        state.tagConfig = startTagConfig;

        if (isStrict && !isFragment && tagStackCursor === -1) {
          if (isRootElementRead) {
            throw new MarkupSyntaxError('Expected a single root element.', input, startIndex - 1, endIndex);
          }
          isRootElementRead = true;
        }

        callback(TOKEN_KIND_START_TAG_NAME, startIndex, endIndex, input);

        tagNameStartIndexStack[++tagStackCursor] = startIndex;
        tagNameEndIndexStack[tagStackCursor] = endIndex;
        tagHashCodeStack[tagStackCursor] = startTagHashCode;
        tagConfigStack[tagStackCursor] = startTagConfig;

        ++enclosingTagHashCodeCounts[startTagHashCode & ENCLOSING_TAG_HASH_CODE_MASK];

        if (startTagConfig !== undefined) {
          if (startTagConfig.foreignContext !== undefined) {
            outerContextStack.push(state.context);
            state.context = startTagConfig.foreignContext;
          }

          const bitIndex = startTagConfig.tagGroupIdBitIndex;

          if (bitIndex !== -1 && ++enclosingTagCounts[bitIndex] === 1) {
            enclosingTagGroupIdMask |= 1 << bitIndex;
          }
        }
        break;
      }

      case TOKEN_KIND_END_TAG_NAME: {
        // The end tag of the innermost enclosing tag, unless it was started in a previous chunk, then it's found below
        if (
          tagStackCursor >= copiedTagNameCount &&
          areTagNamesEqual(
            input,
            tagNameStartIndexStack[tagStackCursor],
            tagNameEndIndexStack[tagStackCursor],
            input,
            startIndex,
            endIndex
          )
        ) {
          // Same as popTag, which V8 doesn't inline on this frequent path
          callback(TOKEN_KIND_END_TAG_NAME, startIndex, endIndex, input);

          --enclosingTagHashCodeCounts[tagHashCodeStack[tagStackCursor] & ENCLOSING_TAG_HASH_CODE_MASK];

          const tagConfig = tagConfigStack[tagStackCursor--];

          if (tagConfig !== undefined) {
            const bitIndex = tagConfig.tagGroupIdBitIndex;

            if (bitIndex !== -1 && --enclosingTagCounts[bitIndex] === 0) {
              enclosingTagGroupIdMask &= ~(1 << bitIndex);
            }
            if (tagConfig.foreignContext !== undefined) {
              state.context = outerContextStack.pop()!;
            }
          }
          break;
        }

        // Include "</"
        const endTagStartIndex = startIndex - 2;

        const endTagHashCode = getTagHashCode(input, startIndex, endIndex);

        const startTagIndex = getStartTagIndex(endTagHashCode, input, startIndex, endIndex);

        // Found a start tag
        if (startTagIndex !== -1) {
          if (!areUnbalancedStartTagsImplicitlyEnded && startTagIndex !== tagStackCursor) {
            throw new MarkupSyntaxError('Expected an end tag.', input, endTagStartIndex);
          }

          // Insert end tags for tags that were started after the matching start tag
          while (startTagIndex < tagStackCursor) {
            callback(TOKEN_KIND_END_TAG_NAME, endTagStartIndex, endTagStartIndex, input);
            popTag();
          }

          callback(TOKEN_KIND_END_TAG_NAME, startIndex, endIndex, input);
          popTag();
          break;
        }

        // Like a start tag, an unbalanced end tag has the config of the context it's read in
        const endTagConfig = getTagConfig(state.context, endTagHashCode, input, startIndex, endIndex, areTagNamesEqual);

        if (endTagConfig === undefined || !endTagConfig.isImplicitlyStarted) {
          if (!areUnbalancedEndTagsIgnored) {
            throw new MarkupSyntaxError('Unexpected end tag.', input, startIndex, endIndex);
          }
          break;
        }

        if ((enclosingTagGroupIdMask & endTagConfig.implicitlyEndedTagGroupIdMask) !== 0) {
          insertImplicitEndTags(endTagConfig.implicitlyEndedTagGroupIds, endTagStartIndex, input);
        }

        state.tagHashCode = endTagHashCode;
        state.tagConfig = endTagConfig;

        callback(TOKEN_KIND_START_TAG_NAME, startIndex, endIndex, input);
        callback(TOKEN_KIND_START_TAG_CLOSING, endIndex, endIndex + 1, input);
        callback(TOKEN_KIND_END_TAG_NAME, startIndex, endIndex, input);
        break;
      }

      // Closings of void tags, and the closing that is inserted if the input ends inside a start tag
      case TOKEN_KIND_START_TAG_CLOSING: {
        callback(TOKEN_KIND_START_TAG_CLOSING, startIndex, endIndex, input);

        const startTagConfig = tagConfigStack[tagStackCursor];

        if (startTagConfig !== undefined && startTagConfig.kind === TAG_KIND_VOID) {
          callback(TOKEN_KIND_END_TAG_NAME, endIndex, endIndex, input);
          popTag();
        }
        break;
      }

      case TOKEN_KIND_START_TAG_SELF_CLOSING:
        callback(TOKEN_KIND_START_TAG_SELF_CLOSING, startIndex, endIndex, input);
        popTag();
        break;
    }
  };

  function read(chunk: string, isInputEnded: boolean): void {
    if (isEnded) {
      throw new Error('The writer is ended.');
    }

    // Nothing new to read
    if (chunk.length === 0 && !isInputEnded) {
      return;
    }

    // If reading throws, the state can be inconsistent, so chunks can't be written after that
    isEnded = true;

    // Strings are joined rather than concatenated, since V8 reads a cons string that concatenation creates slower than a
    // flat string. A cons string with an empty first part isn't flattened by V8 at all.
    const input = unreadInput.length === 0 ? chunk : [unreadInput, chunk].join('');

    state.isInputEnded = isInputEnded;

    try {
      const unreadIndex = readTokens(input, callback, config, state, tagCallback);

      if (isInputEnded) {
        if (tagStackCursor !== -1 && !areUnbalancedStartTagsImplicitlyEnded) {
          throw new MarkupSyntaxError('Unexpected end of the document.', input, input.length);
        }

        // The input ended inside a start tag
        if (state.scope === SCOPE_START_TAG) {
          tagCallback(TOKEN_KIND_START_TAG_CLOSING, input.length, input.length, input);
        }

        while (tagStackCursor !== -1) {
          callback(TOKEN_KIND_END_TAG_NAME, input.length, input.length, input);
          popTag();
        }
        return;
      }

      // The input isn't retained, so names of enclosing tags that were started in this chunk are copied
      for (; copiedTagNameCount <= tagStackCursor; ++copiedTagNameCount) {
        copiedTagNameStack[copiedTagNameCount] = input.substring(
          tagNameStartIndexStack[copiedTagNameCount],
          tagNameEndIndexStack[copiedTagNameCount]
        );
      }

      // Names of ended tags are released
      copiedTagNameStack.length = copiedTagNameCount;

      unreadInput = input.substring(unreadIndex);
      writer.inputOffset += unreadIndex;
    } catch (error) {
      // Indices of errors that the tokenizer throws point to the input
      if (error instanceof MarkupSyntaxError && error.input === input) {
        error.inputOffset = writer.inputOffset;
      }
      throw error;
    }

    isEnded = false;
  }

  // The offset is a property rather than a getter, since V8 allocates accessors of object literals in the old space,
  // where they retain the writer, and everything that the callback retains, until a major garbage collection
  const writer = {
    inputOffset: 0,

    write(chunk: string): void {
      read(chunk, false);
    },

    end(chunk = ''): void {
      read(chunk, true);
    },
  };

  return writer;
}

/**
 * Returns the config of a tag in a context, or `undefined` if options don't mention the tag there.
 *
 * Different names can have equal hash codes, so the name of the tag is compared with the name of a config that has the
 * same hash code.
 *
 * @param context The context to look up the tag in.
 * @param tagHashCode The hash code of the tag name.
 * @param input The text that contains the tag name.
 * @param tagNameStartIndex The index in the input where the tag name starts.
 * @param tagNameEndIndex The index in the input where the tag name ends.
 * @param areTagNamesEqual Compares tag names.
 * @see {@link createTagConfigTable}
 * @internal
 */
export function getTagConfig(
  context: TokenizerContext,
  tagHashCode: number,
  input: string,
  tagNameStartIndex: number,
  tagNameEndIndex: number,
  areTagNamesEqual: TagNameEqualityComparer
): TagParsingConfig | undefined {
  const tagConfigTable = context.tagConfigTable;

  if (tagConfigTable === undefined) {
    return undefined;
  }

  const indexMask = tagConfigTable.length - 1;

  let index = tagHashCode & indexMask;
  let tagConfig = tagConfigTable[index];

  // A vacant index ends the lookup
  while (tagConfig !== undefined) {
    if (
      tagConfig.tagHashCode === tagHashCode &&
      areTagNamesEqual(tagConfig.tagName, 0, tagConfig.tagName.length, input, tagNameStartIndex, tagNameEndIndex)
    ) {
      return tagConfig;
    }

    index = (index + 1) & indexMask;
    tagConfig = tagConfigTable[index];
  }

  return undefined;
}

/**
 * Returns `true` if a tag limits implicit ending.
 *
 * @see {@link TagParsingOptions.isImplicitEndingBoundary}
 */
function isImplicitEndingBoundary(tagConfig: TagParsingConfig | undefined): boolean {
  return tagConfig !== undefined && tagConfig.isImplicitEndingBoundary;
}

/**
 * Returns `true` if a tag must be implicitly ended.
 */
function isImplicitlyEnded(tagConfig: TagParsingConfig | undefined, implicitlyEndedTagGroupIds: number[]): boolean {
  return tagConfig !== undefined && implicitlyEndedTagGroupIds.includes(tagConfig.tagGroupId);
}

// Low bits of the hash code of a tag name that select the count of enclosing tags, see enclosingTagHashCodeCounts
const ENCLOSING_TAG_HASH_CODE_MASK = 15;

// A zero for each count of enclosing tags. createTokenizerWriter copies this array, which is faster than creating an
// array of zeros on every call.
const initialEnclosingTagHashCodeCounts: number[] = [];

for (let index = 0; index <= ENCLOSING_TAG_HASH_CODE_MASK; ++index) {
  initialEnclosingTagHashCodeCounts.push(0);
}

const TAG_KIND_NORMAL = 'normal';
const TAG_KIND_VOID = 'void';
const TAG_KIND_SCRIPT_DATA = 'script_data';

// Nothing was read yet
const SCOPE_INITIAL = -1;
const SCOPE_PROLOGUE = 0;
const SCOPE_TEXT = 1;
const SCOPE_START_TAG = 2;

const TOKEN_KIND_TEXT = 'text';
const TOKEN_KIND_START_TAG_NAME = 'start_tag_name';
const TOKEN_KIND_START_TAG_CLOSING = 'start_tag_closing';
const TOKEN_KIND_START_TAG_SELF_CLOSING = 'start_tag_self_closing';
const TOKEN_KIND_END_TAG_NAME = 'end_tag_name';
const TOKEN_KIND_ATTRIBUTE_NAME = 'attribute_name';
const TOKEN_KIND_ATTRIBUTE_VALUE = 'attribute_value';
const TOKEN_KIND_COMMENT = 'comment';
const TOKEN_KIND_PROCESSING_INSTRUCTION_TARGET = 'processing_instruction_target';
const TOKEN_KIND_PROCESSING_INSTRUCTION_DATA = 'processing_instruction_data';
const TOKEN_KIND_CDATA_SECTION = 'cdata_section';
const TOKEN_KIND_DOCTYPE_NAME = 'doctype_name';

/**
 * Returns `true` if two tag names are equal. Names can be in different strings, since an enclosing tag can be started
 * in a previous chunk.
 *
 * @internal
 */
export type TagNameEqualityComparer = (
  input1: string,
  startIndex1: number,
  endIndex1: number,
  input2: string,
  startIndex2: number,
  endIndex2: number
) => boolean;

/**
 * Reads tokens from text and returns them by invoking a callback.
 *
 * Tokens are returned in the order they appear in text, nothing is inserted, so start and end tags may be unbalanced.
 * Use {@link createTokenizerWriter} to get balanced tokens.
 *
 * The context is read from {@link TokenizerState.context} on every use, and the config of a start tag is read from
 * {@link TokenizerState.tagConfig} after the `start_tag_name` token is passed to the tag callback, which sets the
 * config and can change the context.
 *
 * If {@link TokenizerState.isInputEnded} is `false` then reading stops at a token that reaches the end of the input,
 * since the token can continue in the next chunk, and text before the token isn't returned either. The state keeps
 * everything that is needed to continue, so reading continues with the text that wasn't read, followed by the next
 * chunk.
 *
 * @param input The text to read tokens from.
 * @param callback The callback that is invoked when a token is read.
 * @param config The tokenizer config.
 * @param state The state of reading, which is shared with the callback.
 * @param tagCallback The callback that is invoked instead of `callback` for `start_tag_name`, `end_tag_name`,
 *   `start_tag_self_closing`, and `start_tag_closing` of void tags. {@link createTokenizerWriter} balances tags with
 *   it, so other tokens don't pass through an extra call. It must set {@link TokenizerState.tagConfig} when a
 *   `start_tag_name` token is passed to it. By default, `callback` is invoked for all tokens, and start tags are
 *   looked up before they are passed to it.
 * @returns The index in the input where the text that wasn't read starts, or the input length if the whole input was
 *   read.
 * @throws {@link MarkupSyntaxError} If {@link TokenizerConfig.isStrict} is `true` and input is malformed.
 * @internal
 */
export function readTokens(
  input: string,
  callback: TokenCallback,
  config: TokenizerConfig,
  state: TokenizerState,
  tagCallback = callback
): number {
  const { areTagNamesCaseInsensitive, isFragment, isStrict } = config;

  const inputLength = input.length;

  // A token that reaches this index can continue in the next chunk, so it isn't read. If the input is ended, then no
  // token reaches it.
  const openEndIndex = state.isInputEnded ? -1 : inputLength;

  const areTagNamesEqual = areTagNamesCaseInsensitive
    ? areCaseInsensitiveSubstringsEqual
    : areCaseSensitiveSubstringsEqual;

  const skipName = isStrict ? skipXMLName : skipHTMLName;
  const skipAttributeName = isStrict ? skipXMLName : skipHTMLAttributeName;

  let scope = state.scope;

  if (scope === SCOPE_INITIAL) {
    scope = isFragment ? SCOPE_TEXT : SCOPE_PROLOGUE;
  }

  let textStartIndex = scope === SCOPE_PROLOGUE ? skipSpaces(input, 0) : 0;

  // The hash code is checked at most tags, while other properties of the enclosing raw text tag are rarely used, so they
  // are read from the state
  let enclosingRawTextTagHashCode = state.enclosingRawTextTagHashCode;

  // The closing of a void start tag ends the tag, so it's passed to tagCallback
  let isStartTagVoid = state.isStartTagVoid;

  // Text that was read before has no tokens, so it isn't read again
  let index = textStartIndex + state.pendingTextLength;

  // The index of the end tag that ends the enclosing script data
  let scriptDataEndIndex = -1;

  // Whether an end tag ends script data depends on all script data before it, so it's read again from the start
  if (scope !== SCOPE_START_TAG && enclosingRawTextTagHashCode !== 0 && state.isEnclosingRawTextTagScriptData) {
    index = scriptDataEndIndex = getScriptDataEndIndex(
      input,
      textStartIndex,
      state.enclosingRawTextTagNameInput,
      state.enclosingRawTextTagNameStartIndex,
      state.enclosingRawTextTagNameEndIndex,
      areTagNamesEqual
    );
  }

  // Conditions below compare the char code first, since it rules out most branches before context options are read.
  // Branches that end with a tag continue from the next char, rather than search for the next tag themselves, since the
  // next char is often "<", and the search is done in one place that V8 can inline. A token that can continue in the
  // next chunk breaks the loop at its start index, before anything is passed to callbacks.
  for (let nextIndex = index; index < inputLength; index = nextIndex) {
    let charCode = input.charCodeAt(index);

    if (scope === SCOPE_START_TAG) {
      // Spaces between attributes are skipped here, rather than after each attribute and the tag name. There's usually a
      // single space, so it's skipped without a call.
      if (isSpaceChar(charCode)) {
        ++nextIndex;
        continue;
      }

      // ----------------------------------------------------------
      // Self-closing start tag
      // ----------------------------------------------------------

      if (charCode === /* / */ 47 && state.context.areSelfClosingTagsRecognized) {
        if (getCharCodeAt(input, index + 1) === /* > */ 62) {
          // Skip "/>"
          nextIndex += 2;

          tagCallback(TOKEN_KIND_START_TAG_SELF_CLOSING, index, nextIndex, input);

          // Self-closing raw text tag has no content
          enclosingRawTextTagHashCode = 0;

          scope = SCOPE_TEXT;
          textStartIndex = nextIndex;
          continue;
        }

        // ">" can be in the next chunk
        if (index + 1 === openEndIndex) {
          break;
        }
      }

      // ----------------------------------------------------------
      // Closing of a start tag
      // ----------------------------------------------------------

      if (charCode === /* > */ 62) {
        // Skip ">"
        ++nextIndex;

        if (isStartTagVoid) {
          tagCallback(TOKEN_KIND_START_TAG_CLOSING, index, nextIndex, input);
        } else {
          callback(TOKEN_KIND_START_TAG_CLOSING, index, nextIndex, input);
        }

        scope = SCOPE_TEXT;
        textStartIndex = nextIndex;

        // Script data can contain end tags that don't end it, so the end tag that does is searched for in advance
        if (enclosingRawTextTagHashCode !== 0 && state.isEnclosingRawTextTagScriptData) {
          nextIndex = scriptDataEndIndex = getScriptDataEndIndex(
            input,
            nextIndex,
            state.enclosingRawTextTagNameInput,
            state.enclosingRawTextTagNameStartIndex,
            state.enclosingRawTextTagNameEndIndex,
            areTagNamesEqual
          );
        }
        continue;
      }

      // ----------------------------------------------------------
      // Attribute
      // ----------------------------------------------------------

      nextIndex = skipAttributeName(input, index);

      // No attribute name
      if (nextIndex === index) {
        // Skip illegal char
        if (!isStrict) {
          textStartIndex = ++nextIndex;
          continue;
        }

        throw new MarkupSyntaxError(
          'Expected an attribute name' +
            (state.context.areSelfClosingTagsRecognized ? ", a self-closing start tag ('/>')," : '') +
            " or a start tag closing ('>').",
          input,
          index,
          index + 1
        );
      }

      // The name is passed to the callback along with the value, since the value can be in the next chunk
      const attributeNameEndIndex = nextIndex;

      // Spaces around "=" are rare, so they're skipped only if there are any, rather than with a call every time
      charCode = getCharCodeAt(input, nextIndex);

      if (isSpaceChar(charCode)) {
        nextIndex = skipSpaces(input, nextIndex + 1);
        charCode = getCharCodeAt(input, nextIndex);
      }

      // No attribute value
      if (charCode !== /* = */ 61) {
        // The name or "=" can be in the next chunk
        if (nextIndex === openEndIndex) {
          break;
        }

        callback(TOKEN_KIND_ATTRIBUTE_NAME, index, attributeNameEndIndex, input);

        if (!isStrict) {
          callback(TOKEN_KIND_ATTRIBUTE_VALUE, nextIndex, nextIndex, input);
          continue;
        }

        throw new MarkupSyntaxError(
          "Expected an attribute value separated by an equals sign ('=').",
          input,
          nextIndex,
          nextIndex + 1
        );
      }

      // Skip "="
      ++nextIndex;

      let quoteCharCode = getCharCodeAt(input, nextIndex);

      if (isSpaceChar(quoteCharCode)) {
        nextIndex = skipSpaces(input, nextIndex + 1);
        quoteCharCode = getCharCodeAt(input, nextIndex);
      }

      // ----------------------------------------------------------
      // Unquoted attribute value
      // ----------------------------------------------------------

      if (quoteCharCode !== /* " */ 34 && quoteCharCode !== /* ' */ 39) {
        const attributeValueEndIndex = skipUnquotedAttributeValue(input, nextIndex);

        // The value, or its opening quote char, can be in the next chunk
        if (attributeValueEndIndex === openEndIndex) {
          break;
        }

        callback(TOKEN_KIND_ATTRIBUTE_NAME, index, attributeNameEndIndex, input);

        if (isStrict) {
          throw new MarkupSyntaxError(
            'Expected a double-quoted (\'"\') or a single-quoted ("\'") attribute value.',
            input,
            nextIndex,
            nextIndex + 1
          );
        }

        callback(TOKEN_KIND_ATTRIBUTE_VALUE, nextIndex, (nextIndex = attributeValueEndIndex), input);
        continue;
      }

      // ----------------------------------------------------------
      // Quoted attribute value
      // ----------------------------------------------------------

      // Skip opening quote char
      const attributeValueStartIndex = ++nextIndex;

      nextIndex = getIndexOfOrLength(input, quoteCharCode === /* " */ 34 ? '"' : "'", nextIndex);

      // The closing quote char can be in the next chunk
      if (nextIndex === openEndIndex) {
        break;
      }

      callback(TOKEN_KIND_ATTRIBUTE_NAME, index, attributeNameEndIndex, input);

      if (isStrict && nextIndex === inputLength) {
        throw new MarkupSyntaxError(
          quoteCharCode === /* " */ 34
            ? "Expected the attribute value to be closed with a double-quote ('\"')."
            : 'Expected the attribute value to be closed with a single-quote ("\'").',
          input,
          attributeValueStartIndex,
          inputLength
        );
      }

      callback(TOKEN_KIND_ATTRIBUTE_VALUE, attributeValueStartIndex, nextIndex, input);

      // Skip closing quote char
      ++nextIndex;
      continue;
    }

    // ----------------------------------------------------------
    // Skip to the next tag
    // ----------------------------------------------------------

    if (charCode !== /* < */ 60) {
      scope = SCOPE_TEXT;
      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // Skip "<"
    ++nextIndex;

    charCode = getCharCodeAt(input, nextIndex);

    // ----------------------------------------------------------
    // Processing instruction
    // ----------------------------------------------------------

    if (
      charCode === /* ? */ 63 &&
      state.context.areProcessingInstructionsRecognized &&
      enclosingRawTextTagHashCode === 0
    ) {
      // Skip "?"
      const targetStartIndex = nextIndex + 1;
      const targetEndIndex = skipName(input, targetStartIndex);

      // https://www.w3.org/TR/xml/#sec-pi
      const dataStartIndex = skipSpaces(input, targetEndIndex);
      const dataEndIndex = getIndexOfOrLength(input, '?>', dataStartIndex);

      // "?>" can be in the next chunk
      if (dataEndIndex === openEndIndex) {
        break;
      }

      if (textStartIndex !== index) {
        scope = SCOPE_TEXT;
        callback(TOKEN_KIND_TEXT, textStartIndex, index, input);
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

      callback(TOKEN_KIND_PROCESSING_INSTRUCTION_TARGET, targetStartIndex, targetEndIndex, input);

      if (isStrict && dataEndIndex === inputLength) {
        throw new MarkupSyntaxError(
          "Expected the processing instruction to be closed with '?>'.",
          input,
          index,
          inputLength
        );
      }

      callback(TOKEN_KIND_PROCESSING_INSTRUCTION_DATA, dataStartIndex, dataEndIndex, input);

      // Skip "?>"
      textStartIndex = nextIndex = dataEndIndex + 2;

      if (scope === SCOPE_PROLOGUE) {
        textStartIndex = nextIndex = skipSpaces(input, nextIndex);
        continue;
      }

      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // DOCTYPE
    // ----------------------------------------------------------

    // The char code is compared before the call, since otherwise the call is made at the first tag of every document,
    // and V8 inlines it in place of hotter calls if documents are short
    if (
      charCode === /* ! */ 33 &&
      scope === SCOPE_PROLOGUE &&
      enclosingRawTextTagHashCode === 0 &&
      isDoctypeSectionOpening(input, nextIndex)
    ) {
      // Skip "!DOCTYPE"
      const doctypeNameStartIndex = skipSpaces(input, nextIndex + 8);
      const doctypeNameEndIndex = skipName(input, doctypeNameStartIndex);
      const doctypeClosingIndex = skipUntilTagClosing(input, doctypeNameEndIndex);

      // ">" can be in the next chunk
      if (doctypeClosingIndex === openEndIndex) {
        break;
      }

      callback(TOKEN_KIND_DOCTYPE_NAME, doctypeNameStartIndex, doctypeNameEndIndex, input);

      // Skip ">"
      textStartIndex = nextIndex = skipSpaces(input, doctypeClosingIndex + 1);
      continue;
    }

    // ----------------------------------------------------------
    // CDATA section
    // ----------------------------------------------------------

    if (
      charCode === /* ! */ 33 &&
      state.context.areCDATASectionsRecognized &&
      enclosingRawTextTagHashCode === 0 &&
      isCDATASectionOpening(input, nextIndex, isStrict)
    ) {
      // Skip "![CDATA["
      const cdataSectionStartIndex = nextIndex + 8;
      const cdataSectionEndIndex = getIndexOfOrLength(input, ']]>', cdataSectionStartIndex);

      // "]]>" can be in the next chunk
      if (cdataSectionEndIndex === openEndIndex) {
        break;
      }

      if (textStartIndex !== index) {
        callback(TOKEN_KIND_TEXT, textStartIndex, index, input);
      }

      if (isStrict && cdataSectionEndIndex === inputLength) {
        throw new MarkupSyntaxError("Expected the CDATA section to be closed with ']]>'.", input, index, inputLength);
      }

      callback(TOKEN_KIND_CDATA_SECTION, cdataSectionStartIndex, cdataSectionEndIndex, input);

      scope = SCOPE_TEXT;

      // Skip "]]>"
      textStartIndex = nextIndex = cdataSectionEndIndex + 3;
      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // Comment
    // ----------------------------------------------------------

    if (
      charCode === /* ! */ 33 &&
      enclosingRawTextTagHashCode === 0 &&
      nextIndex + 2 < inputLength &&
      input.charCodeAt(nextIndex + 1) === /* - */ 45 &&
      input.charCodeAt(nextIndex + 2) === /* - */ 45
    ) {
      // Skip "!--"
      const commentStartIndex = nextIndex + 3;

      const commentEndIndex = isStrict
        ? getIndexOfOrLength(input, '-->', commentStartIndex)
        : getHTMLCommentEndIndex(input, commentStartIndex);

      // The comment closing ends with the first ">" after the comment, there's none if the comment isn't closed
      const commentClosingIndex = skipUntilTagClosing(input, commentEndIndex);

      // The comment closing can be in the next chunk
      if (commentClosingIndex === openEndIndex) {
        break;
      }

      if (textStartIndex !== index) {
        scope = SCOPE_TEXT;
        callback(TOKEN_KIND_TEXT, textStartIndex, index, input);
      }

      if (isStrict && commentEndIndex === inputLength) {
        throw new MarkupSyntaxError("Expected the comment to be closed with '-->'.", input, index, inputLength);
      }

      callback(TOKEN_KIND_COMMENT, commentStartIndex, commentEndIndex, input);

      // Skip ">"
      textStartIndex = nextIndex = commentClosingIndex + 1;

      if (scope === SCOPE_PROLOGUE) {
        textStartIndex = nextIndex = skipSpaces(input, nextIndex);
        continue;
      }

      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // Quirky comment
    // ----------------------------------------------------------

    if ((charCode === /* ? */ 63 || charCode === /* ! */ 33) && enclosingRawTextTagHashCode === 0) {
      const commentEndIndex = skipUntilTagClosing(input, nextIndex);

      // ">" can be in the next chunk, and so can the rest of a comment, a CDATA section or a DOCTYPE opening
      if (commentEndIndex === openEndIndex) {
        break;
      }

      if (textStartIndex !== index) {
        scope = SCOPE_TEXT;
        callback(TOKEN_KIND_TEXT, textStartIndex, index, input);
      }

      if (isStrict) {
        throw new MarkupSyntaxError(
          charCode === /* ? */ 63
            ? 'Processing instructions are forbidden.'
            : "Expected a comment ('<!--')" +
                (isFragment || scope !== SCOPE_PROLOGUE ? '' : ", a doctype declaration ('<!DOCTYPE')") +
                (state.context.areCDATASectionsRecognized ? ", or a CDATA section ('<![CDATA[')" : '') +
                '.',
          input,
          nextIndex - 1,
          nextIndex + 1
        );
      }

      // Skip "!", unlike "?" it isn't a part of the comment
      if (charCode === /* ! */ 33) {
        ++nextIndex;
      }

      callback(TOKEN_KIND_COMMENT, nextIndex, commentEndIndex, input);

      // Skip ">"
      textStartIndex = nextIndex = commentEndIndex + 1;

      if (scope === SCOPE_PROLOGUE) {
        textStartIndex = nextIndex = skipSpaces(input, nextIndex);
        continue;
      }

      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    // ----------------------------------------------------------
    // End tag
    // ----------------------------------------------------------

    if (charCode === /* / */ 47) {
      // Skip "/"
      const tagNameStartIndex = ++nextIndex;

      nextIndex = skipName(input, nextIndex);

      // The name can continue in the next chunk
      if (nextIndex === openEndIndex) {
        break;
      }

      // No tag name
      if (tagNameStartIndex === nextIndex) {
        if (isStrict) {
          throw new MarkupSyntaxError(
            'Expected a name for the end tag.',
            input,
            tagNameStartIndex,
            tagNameStartIndex + 1
          );
        }

        // "</" is a part of raw text, and of text at the end of the input
        if (enclosingRawTextTagHashCode !== 0 || nextIndex === inputLength) {
          nextIndex = skipUntilTagOpening(input, nextIndex);
          continue;
        }

        const commentEndIndex = skipUntilTagClosing(input, nextIndex);

        // ">" can be in the next chunk
        if (commentEndIndex === openEndIndex) {
          break;
        }

        if (textStartIndex !== index) {
          callback(TOKEN_KIND_TEXT, textStartIndex, index, input);
        }

        // "</>" is ignored, and anything else is a comment, like "#" in "</#>"
        if (commentEndIndex !== nextIndex) {
          callback(TOKEN_KIND_COMMENT, nextIndex, commentEndIndex, input);
        }

        // Skip ">"
        textStartIndex = nextIndex = commentEndIndex + 1;

        if (scope === SCOPE_PROLOGUE) {
          textStartIndex = nextIndex = skipSpaces(input, nextIndex);
          continue;
        }

        nextIndex = skipUntilTagOpening(input, nextIndex);
        continue;
      }

      // Doesn't match the current raw text tag, the end tag of script data is already checked
      if (
        enclosingRawTextTagHashCode !== 0 &&
        index !== scriptDataEndIndex &&
        !isRawTextTagNameAt(
          input,
          tagNameStartIndex,
          state.enclosingRawTextTagNameInput,
          state.enclosingRawTextTagNameStartIndex,
          state.enclosingRawTextTagNameEndIndex,
          areTagNamesEqual
        )
      ) {
        // The name can contain the opening of the end tag, like in "</a</script>"
        nextIndex = skipUntilTagOpening(input, tagNameStartIndex);
        continue;
      }

      // Unparsable chars after the tag name are skipped, unless the input is read with XML constraints
      const tagClosingIndex = isStrict ? skipSpaces(input, nextIndex) : skipUntilTagClosing(input, nextIndex);

      // ">" can be in the next chunk
      if (tagClosingIndex === openEndIndex) {
        break;
      }

      // End of prolog
      scope = SCOPE_TEXT;

      if (textStartIndex !== index) {
        callback(TOKEN_KIND_TEXT, textStartIndex, index, input);
      }

      tagCallback(TOKEN_KIND_END_TAG_NAME, tagNameStartIndex, nextIndex, input);

      // End the raw text tag
      enclosingRawTextTagHashCode = 0;

      if (isStrict && getCharCodeAt(input, tagClosingIndex) !== /* > */ 62) {
        throw new MarkupSyntaxError(
          "Expected a closing angle bracket ('>').",
          input,
          tagClosingIndex,
          tagClosingIndex + 1
        );
      }

      // Skip ">"
      textStartIndex = nextIndex = tagClosingIndex + 1;
      continue;
    }

    // ----------------------------------------------------------
    // Start tag
    // ----------------------------------------------------------

    // Start tags are ignored inside raw text tags
    if (enclosingRawTextTagHashCode !== 0) {
      // "<" at the end of the input can be followed by the end tag in the next chunk
      if (nextIndex === openEndIndex) {
        break;
      }

      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    const tagNameStartIndex = nextIndex;

    // The name is hashed while it's read, rather than read again by getCaseInsensitiveHashCode or
    // getCaseSensitiveHashCode, which return the same hash code
    let startTagHashCode = 5_381;

    if (isXMLNameStartChar(charCode)) {
      while (true) {
        startTagHashCode =
          ((startTagHashCode << 5) +
            startTagHashCode +
            (areTagNamesCaseInsensitive ? toLowerCaseCharCode(charCode) : charCode)) |
          0;

        if (++nextIndex === inputLength) {
          break;
        }

        charCode = input.charCodeAt(nextIndex);

        if (isStrict ? !isXMLNameChar(charCode) : !isHTMLNameChar(charCode)) {
          break;
        }
      }
    }

    startTagHashCode &= 0x3fffffff;

    // The name can continue in the next chunk
    if (nextIndex === openEndIndex) {
      break;
    }

    // No tag name
    if (tagNameStartIndex === nextIndex) {
      if (isStrict) {
        throw new MarkupSyntaxError(
          'Expected a name for the start tag.',
          input,
          tagNameStartIndex,
          tagNameStartIndex + 1
        );
      }

      // "<" is a part of text, which ends the prolog
      scope = SCOPE_TEXT;
      nextIndex = skipUntilTagOpening(input, nextIndex);
      continue;
    }

    if (textStartIndex !== index) {
      callback(TOKEN_KIND_TEXT, textStartIndex, index, input);
    }

    // The tag callback reads the hash code from the state, rather than hashing the name again
    state.tagHashCode = startTagHashCode;

    // The tag callback looks the tag up, the tag is looked up here only if there's no tag callback. V8 inlines a
    // limited amount of code into a function, so a lookup of every start tag is inlined here in place of hotter
    // functions, while the tag callback is called for every start tag anyway.
    if (tagCallback === callback) {
      state.tagConfig = getTagConfig(
        state.context,
        startTagHashCode,
        input,
        tagNameStartIndex,
        nextIndex,
        areTagNamesEqual
      );
    }

    tagCallback(TOKEN_KIND_START_TAG_NAME, tagNameStartIndex, nextIndex, input);

    // Set by the tag callback, which can also switch the context
    const startTagConfig = state.tagConfig;

    isStartTagVoid = false;

    // Most tags are normal, so the kind of their config is compared once
    if (startTagConfig !== undefined && startTagConfig.kind !== TAG_KIND_NORMAL) {
      isStartTagVoid = startTagConfig.kind === TAG_KIND_VOID;

      // Start of a raw text tag of any kind
      if (!isStartTagVoid) {
        enclosingRawTextTagHashCode = startTagHashCode;

        state.enclosingRawTextTagNameInput = input;
        state.enclosingRawTextTagNameStartIndex = tagNameStartIndex;
        state.enclosingRawTextTagNameEndIndex = nextIndex;
        state.isEnclosingRawTextTagScriptData = startTagConfig.kind === TAG_KIND_SCRIPT_DATA;
      }
    }

    scope = SCOPE_START_TAG;
  }

  state.scope = scope;

  if (state.isInputEnded) {
    // The input may end inside a start tag, after an attribute without a value
    if (scope !== SCOPE_START_TAG && textStartIndex < inputLength) {
      callback(TOKEN_KIND_TEXT, textStartIndex, inputLength, input);
    }
    return inputLength;
  }

  // Text before the index can continue in the next chunk, so it's read again, but isn't searched for tokens
  const resumeIndex = scope !== SCOPE_START_TAG && textStartIndex < index ? textStartIndex : index;

  state.pendingTextLength = index - resumeIndex;
  state.isStartTagVoid = isStartTagVoid;
  state.enclosingRawTextTagHashCode = enclosingRawTextTagHashCode;

  // The name is copied, so the state doesn't retain the input
  const enclosingRawTextTagName = state.enclosingRawTextTagNameInput.substring(
    state.enclosingRawTextTagNameStartIndex,
    state.enclosingRawTextTagNameEndIndex
  );

  state.enclosingRawTextTagNameInput = enclosingRawTextTagName;
  state.enclosingRawTextTagNameStartIndex = 0;
  state.enclosingRawTextTagNameEndIndex = enclosingRawTextTagName.length;

  return resumeIndex;
}

/**
 * Returns `true` if the name of a raw text tag starts at index, and is followed by a space, `/` or `>`. Raw text is
 * ended only by such end tags, so `</script` at the end of the input, or `</scripts>`, is a part of the text.
 *
 * @param input The input to read the name from.
 * @param index The index in the input where the name may start.
 * @param tagNameInput The text that contains the name of the raw text tag.
 * @param tagNameStartIndex The index in tagNameInput where the name of the raw text tag starts.
 * @param tagNameEndIndex The index in tagNameInput where the name of the raw text tag ends.
 * @param areTagNamesEqual Compares tag names.
 */
function isRawTextTagNameAt(
  input: string,
  index: number,
  tagNameInput: string,
  tagNameStartIndex: number,
  tagNameEndIndex: number,
  areTagNamesEqual: TagNameEqualityComparer
): boolean {
  const endIndex = index + tagNameEndIndex - tagNameStartIndex;
  const charCode = getCharCodeAt(input, endIndex);

  return (
    (isSpaceChar(charCode) || charCode === /* / */ 47 || charCode === /* > */ 62) &&
    areTagNamesEqual(tagNameInput, tagNameStartIndex, tagNameEndIndex, input, index, endIndex)
  );
}

/**
 * Returns the index of the end tag that ends script data, or the input length if script data isn't ended.
 *
 * After `<!--` script data is escaped, and a start tag with the name of the script data tag makes it double escaped.
 * End tags don't end double escaped script data, the end tag of the double escaped start tag makes it escaped again,
 * and `-->` ends escaping.
 *
 * @param input The input that contains script data.
 * @param index The index in the input where script data starts.
 * @param tagNameInput The text that contains the name of the script data tag.
 * @param tagNameStartIndex The index in tagNameInput where the name of the script data tag starts.
 * @param tagNameEndIndex The index in tagNameInput where the name of the script data tag ends.
 * @param areTagNamesEqual Compares tag names.
 * @see [HTML Script Data State](https://html.spec.whatwg.org/multipage/parsing.html#script-data-state)
 */
function getScriptDataEndIndex(
  input: string,
  index: number,
  tagNameInput: string,
  tagNameStartIndex: number,
  tagNameEndIndex: number,
  areTagNamesEqual: TagNameEqualityComparer
): number {
  // Most "<" in script data aren't followed by the tag name, so the first char is compared before the whole name. It's
  // compared ignoring case, which is enough to skip a char for case-sensitive names too.
  const tagNameCharCode = getUncheckedCaseInsensitiveCharCodeAt(tagNameInput, tagNameStartIndex);

  let isEscaped = false;
  let isDoubleEscaped = false;

  // The index of "-->" that ends escaping, it is searched for once per "<!--"
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
        getUncheckedCaseInsensitiveCharCodeAt(input, index + 1) === tagNameCharCode &&
        isRawTextTagNameAt(input, index + 1, tagNameInput, tagNameStartIndex, tagNameEndIndex, areTagNamesEqual)
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
      getUncheckedCaseInsensitiveCharCodeAt(input, index) === tagNameCharCode &&
      isRawTextTagNameAt(input, index, tagNameInput, tagNameStartIndex, tagNameEndIndex, areTagNamesEqual)
    ) {
      isDoubleEscaped = true;
    }
  }
}

/**
 * Returns the index where the content of an HTML comment ends.
 *
 * A comment is closed by `-->` or `--!>`, and `<!-->` and `<!--->` are empty comments. If the comment isn't closed,
 * its content ends with the input, except for `-`, `--` or `--!`, which start a comment closing.
 *
 * @param input The input that contains the comment.
 * @param index The index in the input where the comment content starts, after `<!--`.
 * @see [HTML Comment Start State](https://html.spec.whatwg.org/multipage/parsing.html#comment-start-state)
 */
function getHTMLCommentEndIndex(input: string, index: number): number {
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
      // The comment isn't closed, but a dash at the end of the input can start a comment closing
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
}

function getCharCodeAt(input: string, index: number): number {
  return index < input.length ? input.charCodeAt(index) : -1;
}

function getIndexOfOrLength(input: string, searchString: string, index: number): number {
  index = input.indexOf(searchString, index);

  return index !== -1 ? index : input.length;
}

function getUncheckedCaseInsensitiveCharCodeAt(input: string, index: number): number {
  return toLowerCaseCharCode(input.charCodeAt(index));
}

/**
 * Returns `true` if case-insensitive `!DOCTYPE` starts at index.
 */
function isDoctypeSectionOpening(input: string, index: number): boolean {
  return (
    index + 7 < input.length &&
    input.charCodeAt(index) === /* ! */ 33 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 1) === /* d */ 100 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 2) === /* o */ 111 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 3) === /* c */ 99 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 4) === /* t */ 116 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 5) === /* y */ 121 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 6) === /* p */ 112 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 7) === /* e */ 101
  );
}

/**
 * Returns `true` if "![CDATA[" starts at index.
 */
function isCDATASectionOpening(input: string, index: number, isCaseSensitive: boolean): boolean {
  if (isCaseSensitive) {
    return input.startsWith('![CDATA[', index);
  }

  return (
    index + 7 < input.length &&
    input.charCodeAt(index) === /* ! */ 33 &&
    input.charCodeAt(index + 1) === /* [ */ 91 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 2) === /* c */ 99 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 3) === /* d */ 100 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 4) === /* a */ 97 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 5) === /* t */ 116 &&
    getUncheckedCaseInsensitiveCharCodeAt(input, index + 6) === /* a */ 97 &&
    input.charCodeAt(index + 7) === /* [ */ 91
  );
}

// ----------------------------------------------------------
// Check chars
// ----------------------------------------------------------

// https://www.w3.org/TR/xml/#NT-S
function isSpaceChar(charCode: number): boolean {
  // Most chars are above the space, so they're rejected with a single comparison
  return (
    charCode <= /* \s */ 32 &&
    (charCode === /* \s */ 32 || charCode === /* \n */ 10 || charCode === /* \t */ 9 || charCode === /* \r */ 13)
  );
}

// https://www.w3.org/TR/xml/#NT-NameStartChar
function isXMLNameStartChar(charCode: number): boolean {
  // Most names are ASCII, so ranges of other chars are checked in a separate function, which keeps this one small enough
  // for V8 to inline it, along with other functions that read names
  if (charCode < 0x80) {
    return (
      (charCode >= /* a */ 97 && charCode <= /* z */ 122) ||
      (charCode >= /* A */ 65 && charCode <= /* Z */ 90) ||
      charCode === /* _ */ 95 ||
      charCode === /* : */ 58
    );
  }

  return isNonASCIIXMLNameStartChar(charCode);
}

function isNonASCIIXMLNameStartChar(charCode: number): boolean {
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
}

// https://www.w3.org/TR/xml/#NT-NameChar
function isXMLNameChar(charCode: number): boolean {
  // Same as isXMLNameStartChar
  if (charCode < 0x80) {
    return (
      (charCode >= /* a */ 97 && charCode <= /* z */ 122) ||
      (charCode >= /* A */ 65 && charCode <= /* Z */ 90) ||
      (charCode >= /* 0 */ 48 && charCode <= /* 9 */ 57) ||
      charCode === /* - */ 45 ||
      charCode === /* . */ 46 ||
      charCode === /* _ */ 95 ||
      charCode === /* : */ 58
    );
  }

  return isNonASCIIXMLNameChar(charCode);
}

function isNonASCIIXMLNameChar(charCode: number): boolean {
  return (
    isNonASCIIXMLNameStartChar(charCode) ||
    charCode === 0xb7 ||
    (charCode >= 0x0300 && charCode <= 0x036f) ||
    (charCode >= 0x203f && charCode <= 0x2040)
  );
}

// Chars that end names and unquoted values are all below letters, so letters are accepted with a single comparison

function isHTMLNameChar(charCode: number): boolean {
  return charCode > /* > */ 62 || !(charCode === /* / */ 47 || charCode === /* > */ 62 || isSpaceChar(charCode));
}

function isHTMLAttributeNameChar(charCode: number): boolean {
  return (
    charCode > /* > */ 62 ||
    !(charCode === /* / */ 47 || charCode === /* > */ 62 || charCode === /* = */ 61 || isSpaceChar(charCode))
  );
}

// https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(unquoted)-state
function isUnquotedAttributeValueChar(charCode: number): boolean {
  return charCode > /* > */ 62 || !(charCode === /* > */ 62 || isSpaceChar(charCode));
}

// ----------------------------------------------------------
// Skip char sequences
// ----------------------------------------------------------

// Skip functions have their own loops rather than a shared loop that accepts a char predicate, since V8 doesn't inline
// a predicate that is passed as an argument

function skipSpaces(input: string, index: number): number {
  while (index < input.length && isSpaceChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

// https://www.w3.org/TR/xml/#NT-Name
function skipXMLName(input: string, index: number): number {
  if (!isXMLNameStartChar(getCharCodeAt(input, index))) {
    return index;
  }

  // Skip the start char
  ++index;

  while (index < input.length && isXMLNameChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

function skipHTMLName(input: string, index: number): number {
  if (!isXMLNameStartChar(getCharCodeAt(input, index))) {
    return index;
  }

  // Skip the start char
  ++index;

  while (index < input.length && isHTMLNameChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

function skipHTMLAttributeName(input: string, index: number): number {
  while (index < input.length && isHTMLAttributeNameChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

function skipUnquotedAttributeValue(input: string, index: number): number {
  while (index < input.length && isUnquotedAttributeValueChar(input.charCodeAt(index))) {
    ++index;
  }
  return index;
}

// Tags often follow each other or are separated by a single char, and ">" usually follows the name of an end tag, so
// the nearest chars are checked before indexOf is called, which costs more than a few comparisons

function skipUntilTagOpening(input: string, index: number): number {
  if (index + 1 < input.length) {
    if (input.charCodeAt(index) === /* < */ 60) {
      return index;
    }
    if (input.charCodeAt(index + 1) === /* < */ 60) {
      return index + 1;
    }
  }
  return getIndexOfOrLength(input, '<', index);
}

function skipUntilTagClosing(input: string, index: number): number {
  if (index < input.length && input.charCodeAt(index) === /* > */ 62) {
    return index;
  }
  return getIndexOfOrLength(input, '>', index);
}
