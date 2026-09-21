import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260906000000_security_hardening.sql"), "utf8");
const cors = fs.readFileSync(path.join(root, "supabase/functions/_shared/cors.ts"), "utf8");
const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");
const embed = fs.readFileSync(path.join(root, "vertex-ai/js/vertex-ai-embed.js"), "utf8");
const vertexController = fs.readFileSync(path.join(root, "vertex-ai/js/vertex-ai-controller.js"), "utf8");
const manage = fs.readFileSync(path.join(root, "supabase/functions/manage-vsas/index.ts"), "utf8");
const hardening = fs.readFileSync(path.join(root, "supabase/migrations/20260906000000_security_hardening.sql"), "utf8");
const platform = fs.readFileSync(path.join(root, "supabase/migrations/20260824000000_secure_vsas_platform.sql"), "utf8");
const createStaff = fs.readFileSync(path.join(root, "supabase/functions/create-staff/index.ts"), "utf8");

assert.match(migration, /drop policy if exists "Service role can insert profiles"/);
assert.match(migration, /Profiles: own contact update only/);
assert.match(migration, /Avatars: owner upload/);
assert.match(migration, /name ~ '\^\[0-9a-fA-F-\]\{36\}/);
assert.doesNotMatch(cors, /allowedOrigin\s*=.*\|\|\s*"\*"/);
assert.match(config, /\[functions\.create-staff\][\s\S]*verify_jwt = true/);
assert.match(config, /\[functions\.manage-vsas\][\s\S]*verify_jwt = true/);
assert.match(embed, /credentials: "same-origin"/);
assert.match(embed, /await authenticate\(\)/);
assert.match(vertexController, /checkAccess/);
assert.match(manage, /Only administrators can delete staff accounts/);
assert.match(hardening, /validate_attendance_event/);
assert.match(platform, /department_id uuid/);
assert.match(hardening, /Only the current attendance date is available/);
assert.match(hardening, /completed attendance record cannot be reopened/);
assert.doesNotMatch(createStaff, /Temporary password<\/td>/i);

const safeProtocols = ["https://example.com", "http://localhost:4173"];
const unsafeProtocols = ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd"];
for (const value of safeProtocols) assert.match(new URL(value).protocol, /^https?:$/);
for (const value of unsafeProtocols) assert.equal(/^https?:$/.test(new URL(value).protocol), false);

console.log("Security smoke tests passed.");
