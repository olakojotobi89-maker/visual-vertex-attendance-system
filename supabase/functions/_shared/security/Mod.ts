// -----------------------------------------------------------------------
// supabase/functions/_shared/security/mod.ts
//
// Barrel file re-exporting the shared security/validation layer so
// callers can do:
//
//   import { readJsonObject, requireString, ... } from "../_shared/security/mod.ts";
//
// instead of importing from each individual module.
// -----------------------------------------------------------------------

export * from "./body-limits.ts";
export * from "./dangerous-keys.ts";
export * from "./safe-json.ts";
export * from "./validators.ts";
export * from "./schema.ts";