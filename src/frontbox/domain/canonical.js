import { createHash } from 'node:crypto';

// Deterministic JSON with sorted keys. Same input, same bytes, any machine.
export function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalStringify(item)).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + canonicalStringify(value[key])).join(',') + '}';
}

// Content address for a receipt or plan. Approvals bind to this exact hash.
export function contentHash(value) {
  return 'sha256:' + createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex');
}

export function requireFields(record, fields, label) {
  for (const field of fields) {
    if (record === null || record === undefined || record[field] === undefined || record[field] === null || record[field] === '') {
      throw new TypeError(label + ' requires field "' + field + '"');
    }
  }
}
