/**
 * ARIA API Relay Worker
 * Last Larch (lastlarch.com) · CC BY 4.0
 *
 * This worker relays requests from ARIA to AI provider APIs.
 * It does NOT store, log, or inspect request content or API keys.
 * Source is published openly so users can verify this.
 *
 * Deploy: wrangler deploy
 * Or: paste into Cloudflare Workers dashboard at workers.cloudflare.com
 */

const ALLOWED_ORIGINS = [
  'https://lastlarch.com',
  'https://www.lastlarch.com',
];

const ALLOWED_ENDPOINTS = [
  'https://api.anthropic.com',
  'https://api.openai.com',
  'https://generativelanguage.googleapis.com',
  'https://openrouter.ai',
];

export default {
  async fetch(request) {

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Read target URL from header
    const targetUrl = request.headers.get('X-Target-URL');
    if (!targetUrl) {
      return new Response('Missing X-Target-URL header', { status: 400 });
    }

    // Validate target is an allowed AI provider — not an arbitrary URL
    const allowed = ALLOWED_ENDPOINTS.some(e => targetUrl.startsWith(e));
    if (!allowed) {
      return new Response('Target URL not permitted', { status: 403 });
    }

    // Forward the request — pass all original headers except X-Target-URL
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete('X-Target-URL');
    // Remove browser-specific headers that confuse API servers
    forwardHeaders.delete('Origin');
    forwardHeaders.delete('Referer');

    let body;
    try {
      body = await request.text();
    } catch (e) {
      return new Response('Could not read request body', { status: 400 });
    }

    let apiResponse;
    try {
      apiResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: forwardHeaders,
        body,
      });
    } catch (e) {
      return new Response('Failed to reach API provider: ' + e.message, { status: 502 });
    }

    // Stream the response back with CORS headers
    const responseHeaders = new Headers(apiResponse.headers);
    Object.entries(corsHeaders(request)).forEach(([k, v]) => responseHeaders.set(k, v));

    return new Response(apiResponse.body, {
      status: apiResponse.status,
      headers: responseHeaders,
    });
  },
};

function corsHeaders(request) {
  // Allow file:// and any origin — ARIA runs as a local file
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}
