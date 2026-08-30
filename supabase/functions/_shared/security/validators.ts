// -----------------------------------------------------------------------
// supabase/functions/_shared/security/validators.ts
//
// Reusable field-level validation helpers.
//
// These functions VALIDATE and REJECT invalid input — they do not
// sanitize or rewrite values (aside from trimming leading/trailing
// whitespace, which does not change a value's meaning). Anything that
// doesn't pass is treated as an error, not silently "cleaned up".
// -----------------------------------------------------------------------

export interface FieldError {
  field: string;
  message: string;
}

export type FieldResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: FieldError };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A pragmatic (not RFC-exhaustive) email check: local@domain.tld, no
// internal whitespace, at least one dot in the domain part.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same intent as the original isPhone() check in create-staff: an
// optional leading "+", then at least 7 more digits/spaces/dashes.
const PHONE_RE = /^[+\d][\d\s-]{6,}$/;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 254;
}

export function isPhone(value: string): boolean {
  return PHONE_RE.test(value);
}

/** Requires a string field, with optional length bounds. Trims whitespace. */
export function requireString(
  value: unknown,
  field: string,
  opts: { minLength?: number; maxLength?: number } = {},
): FieldResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: { field, message: `${field} must be a string.` } };
  }
  const trimmed = value.trim();
  const min = opts.minLength ?? 1;
  const max = opts.maxLength ?? 500;

  if (trimmed.length < min) {
    return {
      ok: false,
      error: { field, message: `${field} must be at least ${min} character(s) long.` },
    };
  }
  if (trimmed.length > max) {
    return {
      ok: false,
      error: { field, message: `${field} must be ${max} characters or fewer.` },
    };
  }
  return { ok: true, value: trimmed };
}

/** Like requireString, but treats a missing/empty value as `undefined` rather than an error. */
export function optionalString(
  value: unknown,
  field: string,
  opts: { maxLength?: number } = {},
): FieldResult<string | undefined> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: undefined };
  }
  if (typeof value !== "string") {
    return { ok: false, error: { field, message: `${field} must be a string.` } };
  }
  const trimmed = value.trim();
  const max = opts.maxLength ?? 500;
  if (trimmed.length === 0) return { ok: true, value: undefined };
  if (trimmed.length > max) {
    return {
      ok: false,
      error: { field, message: `${field} must be ${max} characters or fewer.` },
    };
  }
  return { ok: true, value: trimmed };
}

export function requireEmail(value: unknown, field = "email"): FieldResult<string> {
  const base = requireString(value, field, { maxLength: 254 });
  if (!base.ok) return base;
  if (!isEmail(base.value)) {
    return { ok: false, error: { field, message: `${field} must be a valid email address.` } };
  }
  return { ok: true, value: base.value.toLowerCase() };
}

export function optionalPhone(value: unknown, field = "phone"): FieldResult<string | undefined> {
  const base = optionalString(value, field, { maxLength: 32 });
  if (!base.ok) return base;
  if (base.value !== undefined && !isPhone(base.value)) {
    return { ok: false, error: { field, message: `${field} is not a valid phone number.` } };
  }
  return base;
}

export function requireUuid(value: unknown, field: string): FieldResult<string> {
  if (typeof value !== "string" || !isUuid(value.trim())) {
    return { ok: false, error: { field, message: `${field} must be a valid UUID.` } };
  }
  return { ok: true, value: value.trim().toLowerCase() };
}

export function optionalUuid(value: unknown, field: string): FieldResult<string | undefined> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: undefined };
  }
  return requireUuid(value, field);
}

export function requireEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): FieldResult<T> {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return {
      ok: false,
      error: { field, message: `${field} must be one of: ${allowed.join(", ")}.` },
    };
  }
  return { ok: true, value: value as T };
}

export function requireBoolean(value: unknown, field: string): FieldResult<boolean> {
  if (typeof value !== "boolean") {
    return { ok: false, error: { field, message: `${field} must be a boolean.` } };
  }
  return { ok: true, value };
}

export function requireUuidArray(
  value: unknown,
  field: string,
  opts: { maxItems?: number } = {},
): FieldResult<string[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: { field, message: `${field} must be an array of UUIDs.` } };
  }
  const maxItems = opts.maxItems ?? 1000;
  if (value.length > maxItems) {
    return {
      ok: false,
      error: { field, message: `${field} must contain ${maxItems} item(s) or fewer.` },
    };
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isUuid(item.trim())) {
      return { ok: false, error: { field, message: `${field} must contain only valid UUIDs.` } };
    }
    out.push(item.trim().toLowerCase());
  }
  return { ok: true, value: out };
}