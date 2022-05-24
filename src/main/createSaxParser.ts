export interface SaxHandler {
  startTag(): void;
  attributeName(): void;
  attributeValue(): void;
  endTag(): void;
  comment(): void;
  processingInstruction(): void;
  cdata(): void;
  doctype(): void;
  text(): void;
}

export interface SaxParser {

}

export function createSaxParser() {}
