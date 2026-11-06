import { Node } from 'flyweight-dom';
import { expect } from 'vitest';

function isEqualNode(a: unknown, b: unknown): boolean | undefined {
  return a instanceof Node && b instanceof Node ? a.isEqualNode(b) : undefined;
}

expect.addEqualityTesters([isEqualNode]);
