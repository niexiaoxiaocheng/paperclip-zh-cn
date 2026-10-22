import assert from 'node:assert/strict';
import { parse } from 'acorn';

const protocolKeys = new Set(['status', 'role', 'adapterType', 'method', 'value', 'id', 'key', 'type', 'command', 'commandName', 'target', 'path', 'url', 'href', 'endpoint', 'provider', 'slug', 'permission', 'capability', 'scope']);

export function invariants(code) {
  const keys = [], comparisons = [], protocol = [];
  function walk(node) {
    if (!node?.type) return;
    if (node.type === 'Property' && !node.computed) {
      const key = node.key.name ?? node.key.value;
      keys.push(key);
      if (protocolKeys.has(key) && node.value.type === 'Literal') protocol.push(node.value.value);
    }
    if (node.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(node.operator)) {
      for (const operand of [node.left, node.right]) if (operand.type === 'Literal' && typeof operand.value === 'string') comparisons.push(operand.value);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value?.type) walk(value);
    }
  }
  walk(parse(code, { ecmaVersion: 'latest', sourceType: 'module' }));
  return { keys, comparisons, protocol };
}

export function checkInvariants(original, translated, name) {
  try {
    assert.deepEqual(invariants(translated), invariants(original));
  } catch {
    throw Error(`${name}: syntax or protocol invariant changed; refusing activation.`);
  }
}
