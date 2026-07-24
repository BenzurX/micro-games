// Foothold beta-feedback Worker
//
// Receives POST { type: "Bug" | "Suggestion", message: string, hp: string } from the
// in-game feedback form and creates a Trello card on the "Cloudflare Worker" intake
// list. Trello is the only system of record - this Worker holds no database.
//
// Env bindings expected (see wrangler.toml):
//   env.ALLOWED_ORIGINS   - comma-separated allowlist of origins (CORS)
//   env.RATE_LIMIT_KV     - KV namespace binding for per-IP rate limiting
//   env.vars.trello       - board/list/label IDs (non-secret, plain vars)
//   env.TRELLO_KEY        - Trello API key (wrangler secret)
//   env.TRELLO_TOKEN      - Trello API token (wrangler secret)

const MAX_MESSAGE_LENGTH = 2000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const corsHeaders = buildCorsHeaders(origin, allowedOrigins);

    // Handle CORS preflight.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    // Reject requests from origins not on the allowlist (defense in depth -
    // browsers already enforce this via CORS, but a direct POST could skip it).
    if (!allowedOrigins.has(origin)) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
    }

    // --- Parse + validate the request body ---
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    if (!body || typeof body.type !== 'string') {
      return jsonResponse({ error: 'Missing "type" field' }, 400, corsHeaders);
    }

    if (body.type !== 'Bug' && body.type !== 'Suggestion') {
      return jsonResponse({ error: '"type" must be "Bug" or "Suggestion"' }, 400, corsHeaders);
    }

    const rawMessage = typeof body.message === 'string' ? body.message : '';
    const trimmedMessage = rawMessage.trim();
    if (trimmedMessage.length === 0) {
      return jsonResponse({ error: '"message" must not be empty' }, 400, corsHeaders);
    }
    const message = trimmedMessage.slice(0, MAX_MESSAGE_LENGTH);

    // Honeypot: bots fill every field they find. A real user's form never
    // populates "hp". If it's non-empty, pretend success but skip Trello
    // entirely, so bots get no signal that they were caught.
    const honeypotTripped = typeof body.hp === 'string' && body.hp.trim().length > 0;

    // --- Per-IP rate limiting via KV ---
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!honeypotTripped) {
      const limited = await isRateLimited(env.RATE_LIMIT_KV, ip);
      if (limited) {
        console.log('[feedback] rate limited:', ip);
        return jsonResponse({ error: 'Too many submissions, please try again later.' }, 429, corsHeaders);
      }
    }

    if (honeypotTripped) {
      // Fake success - no Trello card, no rate-limit bump needed either,
      // since we want the response indistinguishable from a real success.
      console.log('[feedback] honeypot tripped, skipping Trello:', ip);
      return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    try {
      const card = await createTrelloCard(env, body.type, message);
      console.log('[feedback] Trello card created:', card.id, card.shortUrl);
    } catch (err) {
      console.error('[feedback] Trello card creation failed:', err.message);
      return jsonResponse({ error: 'Failed to submit feedback' }, 502, corsHeaders);
    }

    return jsonResponse({ ok: true }, 200, corsHeaders);
  },
};

function parseAllowedOrigins(varValue) {
  const list = (varValue || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(list);
}

function buildCorsHeaders(origin, allowedOrigins) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function jsonResponse(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

// Returns true if this IP has already hit the cap for the current window.
// Uses a single KV key per IP with a TTL so old counters expire on their own.
async function isRateLimited(kv, ip) {
  const key = `ratelimit:${ip}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) || 0 : 0;

  if (count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  return false;
}

async function createTrelloCard(env, type, message) {
  const trello = env.trello || {};
  const idList = trello.list_id;
  const labelBetaFeedback = trello.label_beta_feedback;
  const labelBug = trello.label_bug;
  const labelFeature = trello.label_feature;

  const idLabels = [labelBetaFeedback, type === 'Bug' ? labelBug : labelFeature]
    .filter(Boolean)
    .join(',');

  const name = message.length > 60 ? `${message.slice(0, 60)}...` : message;

  const params = new URLSearchParams({
    idList,
    name,
    desc: message,
    idLabels,
    key: env.TRELLO_KEY,
    token: env.TRELLO_TOKEN,
  });

  const response = await fetch(`https://api.trello.com/1/cards?${params.toString()}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Trello API error ${response.status}: ${text}`);
  }

  return response.json();
}
