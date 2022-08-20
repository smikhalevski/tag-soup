export interface SaxHandler {
  startTag(tagName: string, attributes: { [attributeName: string]: string }): void;

  endTag(tagName: string): void;

  comment(value: string): void;

  processingInstruction(value: string): void;

  cdata(value: string): void;

  doctype(value: string): void;

  text(value: string): void;
}

export interface SaxParser {}

export function createSaxParser() {}
