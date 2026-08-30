// -----------------------------------------------------------------------
// supabase/functions/_shared/security/body-limits.ts
//
// Request body size protection.
//
// Content-Length headers can be missing, wrong, or spoofed by a client,
// so this module enforces size limits in two layers:
//
//   1. An early check against the Content-Length header (cheap, but not
//      trustworthy on its own — a client can lie about it or omit it).
//   2. A hard limit enforced while actually reading the request body
//      stream, which is what protects the server even if Content-Length
//      is absent or incorrect.
//
// Callers should treat (2) as the real guarantee and (1) as an optional
// fast-path used to avoid reading a stream we already know is too large.
// -----------------------------------------------------------------------

/** Maximum accepted size for a JSON request body. Override per-route if needed. */
export const DEFAULT_MAX_JSON_BODY_BYTES = 100 * 1024; // 100 KB

/**
 * Soft ceiling for the multipart/form-data create-staff request. This is
 * enforced via the Content-Length pre-check (see the note in
 * create-staff/index.ts) — the per-field text length limits and the
 * existing 2MB avatar limit provide the real protection for that route,
 * since `req.formData()` consumes the whole stream internally and cannot
 * be interrupted mid-read the way a manual JSON body read can.
 */
export const DEFAULT_MAX_MULTIPART_BODY_BYTES = 6 * 1024 * 1024; // 6 MB

export interface BodyTooLarge {
  ok: false;
  status: 413;
  message: string;
}

export interface BodyReadOk {
  ok: true;
  bytes: Uint8Array;
}

export type BodyReadResult = BodyReadOk | BodyTooLarge;

/**
 * Cheap early rejection based on the Content-Length header, if present.
 * Returns an error result when the declared size already exceeds the
 * limit. Returns `null` when the header is missing, unparsable, or
 * within bounds — callers must still enforce the limit on the actual
 * stream for JSON bodies (see `readBodyWithLimit`).
 */
export function rejectByContentLength(
  req: Request,
  maxBytes: number,
): BodyTooLarge | null {
  const header = req.headers.get("content-length");
  if (!header) return null;

  const declared = Number(header);
  if (!Number.isFinite(declared) || declared < 0) return null;

  if (declared > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: `Request body exceeds the maximum allowed size of ${maxBytes} bytes.`,
    };
  }
  return null;
}

/**
 * Reads a request body stream into memory while enforcing `maxBytes`,
 * regardless of what (or whether) Content-Length claims. This is the
 * authoritative guard — it cancels the stream as soon as the limit is
 * crossed instead of buffering an unbounded body.
 */
export async function readBodyWithLimit(
  req: Request,
  maxBytes: number,
): Promise<BodyReadResult> {
  const early = rejectByContentLength(req, maxBytes);
  if (early) return early;

  const stream = req.body;
  if (!stream) {
    return { ok: true, bytes: new Uint8Array(0) };
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        // Stop reading immediately; do not buffer the rest of the stream.
        await reader.cancel().catch(() => {});
        return {
          ok: false,
          status: 413,
          message: `Request body exceeds the maximum allowed size of ${maxBytes} bytes.`,
        };
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // May already be released by cancel(); safe to ignore.
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes: merged };
}