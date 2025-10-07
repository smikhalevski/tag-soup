import { decodeXML } from 'speedy-entities';

import { ParserOptions } from './types.js';

export const xmlParserOptions: ParserOptions = {
  isProcessingInstructionRecognized: true,
  isCDATARecognized: true,
  isStrict: true,
  decodeText: decodeXML,
};
