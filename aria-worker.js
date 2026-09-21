/**
 * ARIA API Relay Worker
 * Last Larch (lastlarch.com) · MIT License
 *
 * This worker relays requests from ARIA to AI provider APIs.
 * It does NOT store, log, or inspect request content or API keys.
 * Source is published openly so users can verify this.
 *
 * Deploy: wrangler deploy
 * Or: paste into Cloudflare Workers dashboard at workers.cloudflare.com
 */

// Only these provider origins can be reached. Matching is exact and is done on
// the parsed origin (scheme, host and port), never on a prefix of the URL.
const ALLOWED_TARGET_ORIGINS = new Set([
  'https://api.anthropic.com',
  'https://api.openai.com',
  'https://generativelanguage.googleapis.com',
  'https://openrouter.ai',
]);

// Returns a URL object if the target is an allowed provider, otherwise null.
function parseAllowedTarget(value) {
  let url;
  try {
    url = new URL(value);
  } catch (e) {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (!ALLOWED_TARGET_ORIGINS.has(url.origin)) return null;
  return url;
}

export default {
  async fetch(request) {

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== 'POST') {
      return errorResponse(405, 'Method not allowed');
    }

    // Read target URL from header
    const targetUrl = request.headers.get('X-Target-URL');
    if (!targetUrl) {
      return errorResponse(400, 'Missing X-Target-URL header');
    }

    // The target must be an allowed AI provider, not an arbitrary URL
    const target = parseAllowedTarget(targetUrl);
    if (!target) {
      return errorResponse(403, 'Target URL not permitted');
    }

    // Forward the request with all original headers except X-Target-URL
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete('X-Target-URL');
    // Remove browser-specific headers that confuse API servers
    forwardHeaders.delete('Origin');
    forwardHeaders.delete('Referer');

    let body;
    try {
      body = await request.text();
    } catch (e) {
      return errorResponse(400, 'Could not read request body');
    }

    let apiResponse;
    try {
      apiResponse = await fetch(target.href, {
        method: 'POST',
        headers: forwardHeaders,
        body,
      });
    } catch (e) {
      return errorResponse(502, 'Failed to reach API provider: ' + e.message);
    }

    // Stream the response back with CORS headers
    const responseHeaders = new Headers(apiResponse.headers);
    Object.entries(corsHeaders()).forEach(([k, v]) => responseHeaders.set(k, v));

    return new Response(apiResponse.body, {
      status: apiResponse.status,
      headers: responseHeaders,
    });
  },
};

// Errors are returned as JSON with CORS headers, so the browser can read them
// and ARIA can show the message instead of a generic network error.
function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function corsHeaders() {
  // Allow file:// and any other origin, because ARIA runs as a local file
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}
