// -----------------------------------------------------------------------
// supabase/functions/_shared/security/safe-json.ts
//
// Reusable helper for safely reading a JSON request body:
//   - enforces a maximum size (see body-limits.ts)
//   - rejects malformed JSON
//   - rejects empty bodies when an object is required
//   - requires the root value to be a plain object (not an array/primitive)
//   - rejects dangerous keys anywhere in the structure (see dangerous-keys.ts)
//
// None of the errors returned here leak internal stack traces — callers
// pass `message` straight into the existing `errorResponse()` helper.
// -----------------------------------------------------------------------

import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  readBodyWithLimit,
} from "./body-limits.ts";
import { findDangerousKey } from "./dangerous-keys.ts";

export interface JsonReadError {
  ok: false;
  status: number;
  message: string;
}

export interface JsonReadOk {
  ok: true;
  value: Record<string, unknown>;
}

export type JsonReadResult = JsonReadOk | JsonReadError;

export interface ReadJsonObjectOptions {
  /** Maximum accepted body size in bytes. Defaults to DEFAULT_MAX_JSON_BODY_BYTES. */
  maxBytes?: number;
}

/**
 * Reads and validates a request body as a strict JSON object.
 *
 * Use this instead of `req.json()` for any endpoint that expects a JSON
 * object body — it guarantees the caller gets back either a safe,
 * dangerous-key-free plain object, or a structured error suitable for
 * `errorResponse(result.status, result.message)`.
 */
export async function readJsonObject(
  req: Request,
  options: ReadJsonObjectOptions = {},
): Promise<JsonReadResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;

  const bodyResult = await readBodyWithLimit(req, maxBytes);
  if (!bodyResult.ok) {
    return { ok: false, status: bodyResult.status, message: bodyResult.message };
  }

  if (bodyResult.bytes.byteLength === 0) {
    return { ok: false, status: 400, message: "Request body must not be empty." };
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bodyResult.bytes);
  } catch {
    return { ok: false, status: 400, message: "Request body must be valid UTF-8 text." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, message: "Request body must be valid JSON." };
  }

  if (Array.isArray(parsed)) {
    return {
      ok: false,
      status: 400,
      message: "Request body must be a JSON object, not an array.",
    };
  }

  if (parsed === null || typeof parsed !== "object") {
    return { ok: false, status: 400, message: "Request body must be a JSON object." };
  }

  const dangerous = findDangerousKey(parsed);
  if (dangerous.found) {
    return { ok: false, status: 400, message: "Request body contains a disallowed field name." };
  }

  return { ok: true, value: parsed as Record<string, unknown> };
}