// -----------------------------------------------------------------------
// supabase/functions/_shared/cors.ts
// Shared CORS headers for all Edge Functions in this project.
//
// 🔐 Before deploying to production, replace the wildcard origin with
//    your actual production domain:
//      "Access-Control-Allow-Origin": "https://vsas.yourcompany.com"
// -----------------------------------------------------------------------

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Returns a 200 OK response for CORS preflight (OPTIONS) requests.
 * Every Edge Function handler should call this for `req.method === "OPTIONS"`.
 */
export function handleOptions(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}

/**
 * Creates a JSON response with the shared CORS headers applied.
 */
export function jsonResponse(
  status: number,
  body: unknown,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * Creates an error JSON response.
 */
export function errorResponse(
  status: number,
  message: string,
): Response {
  return jsonResponse(status, { error: message });
}

