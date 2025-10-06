import { htmlParserOptions } from './htmlParserOptions.js';
import { createSAXParser } from './createSAXParser.js';

/**
 * @group SAX
 */
export const HTMLSAXParser = createSAXParser(htmlParserOptions);
