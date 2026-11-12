import fs from 'node:fs';
import {
  CDATASection,
  Comment,
  DocumentType,
  Element,
  type Node,
  type ParentNode,
  ProcessingInstruction,
  Text,
} from 'flyweight-dom';
import { describe, expect, test } from 'vitest';
import { HTMLDOMParser } from '../main/index.ts';
import { html5libTestFileNames, html5libTestsDir } from './html5lib-utils.ts';

// Indices of tests in each file that the HTML parser doesn't pass. If a test starts to pass, remove it from this list.
const incompatibleTestIndicesMap = new Map<string, number[]>(
  Object.entries(JSON.parse(fs.readFileSync(new URL('./html5lib-incompatible.json', import.meta.url), 'utf8'))),
);

interface Html5libTest {
  data: string;
  isFragment: boolean;
  document: string;
}

type TreeNode =
  | { type: 'element'; name: string; attributes: string[][]; children: TreeNode[] }
  | { type: 'text' | 'comment' | 'doctype' | 'processing_instruction'; value: string };

// Files are downloaded by global-setup.ts
for (const fileName of html5libTestFileNames) {
  const incompatibleTestIndices = incompatibleTestIndicesMap.get(fileName) ?? [];

  describe(fileName, () => {
    readTests(fs.readFileSync(new URL(fileName, html5libTestsDir), 'utf8')).forEach((html5libTest, index) => {
      const testName = index + ': ' + JSON.stringify(html5libTest.data);

      (incompatibleTestIndices.includes(index) ? test.fails : test)(testName, () => {
        const actualNodes = html5libTest.isFragment
          ? readNodes(HTMLDOMParser.parseFragment(html5libTest.data))
          : readNodes(HTMLDOMParser.parseDocument(html5libTest.data));

        expect(stringifyNodes(normalizeNodes(actualNodes))).toBe(
          stringifyNodes(normalizeNodes(parseExpectedNodes(html5libTest.document))),
        );
      });
    });
  });
}

/**
 * Reads tests from a .dat file. A test has sections that start with a "#" line: "#data", "#errors", "#document" and
 * others.
 */
function readTests(text: string): Html5libTest[] {
  const tests: Html5libTest[] = [];

  let sectionMap = new Map<string, string[]>();
  let sectionLines: string[] = [];

  for (const line of text.split('\n')) {
    if (/^#[a-z-]+$/.test(line)) {
      // Each test starts with data
      if (line === '#data' && sectionMap.has('data')) {
        tests.push(createTest(sectionMap));
        sectionMap = new Map();
      }

      sectionLines = [];
      sectionMap.set(line.substring(1), sectionLines);
      continue;
    }

    sectionLines.push(line);
  }

  if (sectionMap.has('data')) {
    tests.push(createTest(sectionMap));
  }
  return tests;
}

function createTest(sectionMap: Map<string, string[]>): Html5libTest {
  return {
    data: sectionMap.get('data')!.join('\n'),
    isFragment: sectionMap.has('document-fragment'),
    // Tests are separated by an empty line
    document: sectionMap.get('document')!.join('\n').replace(/\n+$/, ''),
  };
}

/**
 * Parses the expected tree: a line for each node that starts with "| " and an indent of 2 spaces for each level of
 * nesting. Attributes follow their element one level deeper, and text and comments can span several lines.
 */
function parseExpectedNodes(document: string): TreeNode[] {
  const nodeLines: string[] = [];

  for (const line of document.split('\n')) {
    if (line.startsWith('| ')) {
      nodeLines.push(line.substring(2));
    } else if (nodeLines.length !== 0) {
      nodeLines[nodeLines.length - 1] += '\n' + line;
    }
  }

  const rootNodes: TreeNode[] = [];
  const childrenStack = [rootNodes];

  let element: Extract<TreeNode, { type: 'element' }> | undefined;
  let elementDepth = -1;

  for (const nodeLine of nodeLines) {
    const content = nodeLine.trimStart();
    const depth = (nodeLine.length - content.length) / 2;

    // Text starts with a quote
    const attributeMatch = content.startsWith('"') ? null : /^(.+?)="([\s\S]*)"$/.exec(content);

    if (element !== undefined && depth === elementDepth + 1 && attributeMatch !== null) {
      element.attributes.push([attributeMatch[1], attributeMatch[2]]);
      continue;
    }

    element = undefined;

    let node: TreeNode;

    if (content === 'content') {
      // Template contents are children of the template
      childrenStack[depth + 1] = childrenStack[depth];
      continue;
    } else if (content.startsWith('"')) {
      node = { type: 'text', value: content.slice(1, -1) };
    } else if (content.startsWith('<!-- ')) {
      node = { type: 'comment', value: content.slice(5, -4) };
    } else if (content.startsWith('<!DOCTYPE ')) {
      node = { type: 'doctype', value: content.slice(10, -1) };
    } else if (content.startsWith('<?')) {
      node = { type: 'processing_instruction', value: content.slice(2, -2) };
    } else {
      // The namespace of a foreign element precedes its name
      node = { type: 'element', name: content.slice(1, -1).replace(/^(svg|math) /, ''), attributes: [], children: [] };

      element = node;
      elementDepth = depth;
      childrenStack[depth + 1] = node.children;
    }

    childrenStack[depth].push(node);
  }

  return rootNodes;
}

/**
 * Reads child nodes that the parser created.
 */
function readNodes(parentNode: ParentNode): TreeNode[] {
  const nodes: TreeNode[] = [];

  for (let node: Node | null = parentNode.firstChild; node !== null; node = node.nextSibling) {
    if (node instanceof Element) {
      nodes.push({
        type: 'element',
        name: node.tagName,
        attributes: Object.entries(node.attributes),
        children: readNodes(node),
      });
    } else if (node instanceof Text || node instanceof CDATASection) {
      nodes.push({ type: 'text', value: node.data });
    } else if (node instanceof Comment) {
      nodes.push({ type: 'comment', value: node.data });
    } else if (node instanceof ProcessingInstruction) {
      nodes.push({ type: 'processing_instruction', value: node.target + ' ' + node.data });
    } else if (node instanceof DocumentType) {
      const ids = node.publicId !== '' || node.systemId !== '' ? ` "${node.publicId}" "${node.systemId}"` : '';

      nodes.push({ type: 'doctype', value: node.name + ids });
    }
  }
  return nodes;
}

/**
 * Brings trees to the form that the parser can produce. Names are compared in lower case and without namespaces,
 * since the parser keeps the source case and has no namespaces. html, head and body are replaced with their children,
 * since the parser doesn't insert them. Adjacent text nodes are merged.
 */
function normalizeNodes(nodes: TreeNode[]): TreeNode[] {
  const normalizedNodes: TreeNode[] = [];

  for (const node of nodes) {
    let normalizedNode = node;

    if (node.type === 'element') {
      const name = node.name.toLowerCase();

      if (name === 'html' || name === 'head' || name === 'body') {
        for (const childNode of normalizeNodes(node.children)) {
          appendNode(normalizedNodes, childNode);
        }
        continue;
      }

      normalizedNode = {
        type: 'element',
        name,
        attributes: node.attributes
          .map(([attributeName, value]) => [attributeName.replace(/^(xlink|xml|xmlns) /, '$1:').toLowerCase(), value])
          .sort((attribute1, attribute2) => (attribute1[0] < attribute2[0] ? -1 : 1)),
        children: normalizeNodes(node.children),
      };
    }

    if (node.type === 'doctype') {
      normalizedNode = { type: 'doctype', value: node.value.replace(/^\S*/, name => name.toLowerCase()) };
    }

    appendNode(normalizedNodes, normalizedNode);
  }
  return normalizedNodes;
}

/**
 * Appends a node to nodes, or merges a text node with the last text node.
 */
function appendNode(nodes: TreeNode[], node: TreeNode): void {
  const lastNode = nodes[nodes.length - 1];

  if (node.type === 'text' && lastNode !== undefined && lastNode.type === 'text') {
    nodes[nodes.length - 1] = { type: 'text', value: lastNode.value + node.value };
  } else {
    nodes.push(node);
  }
}

/**
 * Converts nodes to the format of expected trees, so a failed test shows the difference line by line.
 */
function stringifyNodes(nodes: TreeNode[], depth = 0): string {
  const indent = '| ' + '  '.repeat(depth);

  let str = '';

  for (const node of nodes) {
    switch (node.type) {
      case 'element':
        str += indent + '<' + node.name + '>\n';

        for (const [name, value] of node.attributes) {
          str += indent + '  ' + name + '="' + value + '"\n';
        }

        str += stringifyNodes(node.children, depth + 1);
        break;

      case 'text':
        str += indent + '"' + node.value + '"\n';
        break;

      case 'comment':
        str += indent + '<!-- ' + node.value + ' -->\n';
        break;

      case 'doctype':
        str += indent + '<!DOCTYPE ' + node.value + '>\n';
        break;

      case 'processing_instruction':
        str += indent + '<?' + node.value + '?>\n';
        break;
    }
  }
  return str;
}
