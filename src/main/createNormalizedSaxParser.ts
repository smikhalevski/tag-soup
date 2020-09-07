import {
  createAttrPool,
  parseSax,
  SaxParser,
  SaxParserCallbacks,
  SaxParserDialectOptions,
  SaxParserOptions,
} from './createSaxParser';
import {TagType} from './TagType';
import {createObjectPool} from './createObjectPool';

export interface NormalizedSaxParserDialectOptions extends SaxParserDialectOptions {
  isText?: (tagName: string) => boolean;
  isDiscarded?: (tagName: string) => boolean;
  isImplicitEnd?: (prevTagName: string, nextTagName: string) => boolean;
  isContinuousAfterStart?: (prevTagName: string, nextTagName: string) => boolean;
  isContinuousAfterEnd?: (prevTagName: string, nextTagName: string) => boolean;
}

export interface NormalizedSaxParserOptions extends NormalizedSaxParserDialectOptions, SaxParserCallbacks {
}

export function createNormalizedSaxParser(options: NormalizedSaxParserOptions): SaxParser {
  const {
    onStartTag,
    onEndTag,
    onText,
    isText,
    isDiscarded,
    isImplicitEnd,
    isContinuousAfterStart,
    isContinuousAfterEnd,
  } = options;

  const attrPoolPool = createObjectPool(createAttrPool);

  let tail = '';
  let offset = 0;

  let tagNameStack: Array<string> = [];
  let tagTypeStack: Array<TagType> = [];
  let depth = 0;

  let text = '';
  let textStart = -1;
  let textEnd = -1;

  const emitText = () => {
    if (textStart !== -1) {
      onText?.(text, textStart, textEnd);
      textStart = textEnd = -1;
    }
  };

  const addText = (data: string, start: number, end: number) => {
    if (textStart === -1) {
      text = data;
      textStart = start;
    } else {
      text += data;
    }
    textEnd = end;
  };

  const overrides: SaxParserOptions = {

    onStartTag(tagName, selfClosing, tagType, start, end) {
      if (isDiscarded?.(tagName)) {
        return;
      }
      if (isText?.(tagName)) {
        addText(tail.substr(start - offset, end - offset), start, end);
        return;
      }

      emitText();

      if (tagType === TagType.VOID) {
        selfClosing = true;
      }

      let k = -1;
      for (let i = depth - 1; i >= 0; i--) {
        if (isImplicitEnd?.(tagNameStack[i], tagName)) {
          k = i;
          break;
        }
      }
      if (k !== -1) {
        for (let i = depth - 1; i >= k; i--) {
          onEndTag?.(tagNameStack[i], start, start);
        }
      }
      onStartTag?.(tagName, selfClosing, tagType, start, end);

      if (k !== -1) {
        let j = k;
        if (isContinuousAfterStart) {
          for (let i = k; i < depth; i++) {
            if (isContinuousAfterStart(tagNameStack[i], tagName)) {
              onStartTag?.(tagNameStack[i], false, tagTypeStack[i], end, end);

              // REPLAY ATTRIBUTES

              tagNameStack[j] = tagNameStack[i];
              tagTypeStack[j] = tagTypeStack[i];
              j++;
            }
          }
        }
        if (!selfClosing) {
          tagNameStack.splice(k, 0, tagName);
          tagTypeStack.splice(k, 0, tagType);
          depth = j + 1;
        } else {
          depth = j;
        }
      } else if (!selfClosing) {
        tagNameStack[depth] = tagName;
        tagTypeStack[depth] = tagType;
        depth++;
      }
    },

    onEndTag(tagName, start, end) {
      if (isDiscarded?.(tagName)) {
        return;
      }
      if (isText?.(tagName)) {
        addText(tail.substr(start - offset, end - offset), start, end);
        return;
      }

      let k = depth - 1;
      while (k >= 0 && tagNameStack[k] !== tagName) {
        k--;
      }
      if (k === -1) {
        return;
      }
      emitText();

      for (let i = depth - 1; i > k; i--) {
        onEndTag?.(tagNameStack[i], start, start);
      }
      onEndTag?.(tagName, start, end);

      if (isContinuousAfterEnd) {
        for (let i = k + 1; i < depth; i++) {
          if (isContinuousAfterEnd(tagNameStack[i], tagName)) {
            onStartTag?.(tagNameStack[i], false, tagTypeStack[i], end, end);

            // REPLAY ATTRIBUTES

            tagNameStack[k] = tagNameStack[i];
            tagTypeStack[k] = tagTypeStack[i];
            k++;
          }
        }
      }
      depth = k;
    },

    onText: addText,
  };

  options = Object.assign({}, options, overrides);

  return {
    resetStream() {
      tail = '';
      offset = 0;
    },
    writeStream(str) {
      tail += str;
      const l = parseSax(tail, attrPoolPool, true, offset, options);
      tail = str.substr(l);
      offset += l;
    },
    commit(str = '') {
      tail += str;
      const l = parseSax(tail, attrPoolPool, false, offset, options);
      tail = '';
      offset += l;

      emitText();
      for (let i = depth - 1; i >= 0; i--) {
        onEndTag?.(tagNameStack[i], offset, offset);
      }

      offset = 0;
    },
  };
}
