// -----------------------------------------------------------------------
// supabase/functions/_shared/security/dangerous-keys.ts
//
// Recursive protection against prototype-pollution-style payloads.
//
// This does not mutate any global prototype — it only inspects plain
// data produced by JSON.parse() and reports whether any object in the
// structure (at any depth, including inside arrays) uses a dangerous
// key name.
// -----------------------------------------------------------------------

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/** Guards against pathological/deeply-nested payloads causing unbounded recursion. */
const MAX_SCAN_DEPTH = 32;

export interface DangerousKeyCheck {
  found: boolean;
  path?: string;
}

/**
 * Recursively scans a JSON-parsed value for dangerous object keys.
 * Returns `{ found: true, path }` on the first match, where `path` is a
 * human-readable dotted path useful for logging (never shown to the
 * client verbatim).
 */
export function findDangerousKey(
  value: unknown,
  path = "$",
  depth = 0,
): DangerousKeyCheck {
  if (depth > MAX_SCAN_DEPTH) {
    return { found: true, path: `${path} (max nesting depth exceeded)` };
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const result = findDangerousKey(value[i], `${path}[${i}]`, depth + 1);
      if (result.found) return result;
    }
    return { found: false };
  }

  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(key)) {
        return { found: true, path: `${path}.${key}` };
      }
      const result = findDangerousKey(
        (value as Record<string, unknown>)[key],
        `${path}.${key}`,
        depth + 1,
      );
      if (result.found) return result;
    }
  }

  return { found: false };
}

/** Convenience boolean wrapper around `findDangerousKey`. */
export function containsDangerousKeys(value: unknown): boolean {
  return findDangerousKey(value).found;
}