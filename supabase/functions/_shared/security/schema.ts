// -----------------------------------------------------------------------
// supabase/functions/_shared/security/schema.ts
//
// Allowlist enforcement for request payload shapes.
//
// Use this to reject requests that include fields a given action does
// not expect, instead of silently ignoring (or worse, using) them.
// -----------------------------------------------------------------------

/**
 * Returns the list of keys present in `body` that are NOT in `allowed`.
 * An empty array means the payload only contains expected fields.
 */
export function findUnexpectedFields(
  body: Record<string, unknown>,
  allowed: readonly string[],
): string[] {
  const allowedSet = new Set(allowed);
  return Object.keys(body).filter((key) => !allowedSet.has(key));
}

export interface AllowlistResult {
  ok: boolean;
  unexpected: string[];
}

/**
 * Convenience wrapper: checks a payload against an allowlist and reports
 * both the pass/fail outcome and the offending field names (useful for
 * error messages and logging).
 */
export function checkAllowlist(
  body: Record<string, unknown>,
  allowed: readonly string[],
): AllowlistResult {
  const unexpected = findUnexpectedFields(body, allowed);
  return { ok: unexpected.length === 0, unexpected };
}