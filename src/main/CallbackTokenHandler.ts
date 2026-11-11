import type { TokenHandler } from './tokenizeMarkup.ts';
import type { TokenCallback } from './types.ts';
import { keepHiddenClasses } from './utils.ts';

/**
 * Passes tokens to a {@link TokenCallback}. The callback is called through a local, so like a plain function it gets
 * `this` undefined rather than the handler.
 *
 * @internal
 */
export class CallbackTokenHandler implements TokenHandler {
  callback: TokenCallback;

  constructor(callback: TokenCallback) {
    this.callback = callback;
  }

  onText(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('text', startIndex, endIndex, input);
  }

  onStartTagName(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('start_tag_name', startIndex, endIndex, input);
  }

  onStartTagClosing(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('start_tag_closing', startIndex, endIndex, input);
  }

  onStartTagSelfClosing(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('start_tag_self_closing', startIndex, endIndex, input);
  }

  onEndTagName(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('end_tag_name', startIndex, endIndex, input);
  }

  onAttributeName(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('attribute_name', startIndex, endIndex, input);
  }

  onAttributeValue(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('attribute_value', startIndex, endIndex, input);
  }

  onComment(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('comment', startIndex, endIndex, input);
  }

  onProcessingInstructionTarget(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('processing_instruction_target', startIndex, endIndex, input);
  }

  onProcessingInstructionData(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('processing_instruction_data', startIndex, endIndex, input);
  }

  onCDATASection(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('cdata_section', startIndex, endIndex, input);
  }

  onDoctypeName(startIndex: number, endIndex: number, input: string): void {
    const callback = this.callback;

    callback('doctype_name', startIndex, endIndex, input);
  }
}

keepHiddenClasses(new CallbackTokenHandler(() => {}));
