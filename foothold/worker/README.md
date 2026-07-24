# Foothold Feedback Worker

A Cloudflare Worker that is the backend for Foothold's in-game beta-feedback form.
It receives a POST from the game, validates it, applies a honeypot check and a
per-IP rate limit, then files a Trello card. There is no database - Trello is the
system of record.

## Request contract

`POST /` with JSON body:

```json
{
  "type": "Bug",
  "message": "The tide wipe animation flickers on the third level.",
  "hp": ""
}
```

- `type` - must be exactly `"Bug"` or `"Suggestion"`. Anything else is rejected (400).
- `message` - required, non-empty after trimming. Longer than 2000 characters gets
  truncated (not rejected). Empty after trimming is rejected (400).
- `hp` - honeypot field. Real users never fill this in. If it's non-empty, the
  Worker returns a normal-looking `200 { "ok": true }` but silently skips creating
  a Trello card, so bots get no signal they were caught.

Responses:

- `200 { "ok": true }` - card created (or honeypot silently swallowed).
- `400 { "error": "..." }` - invalid JSON, bad `type`, or empty `message`.
- `403 { "error": "Origin not allowed" }` - request came from an origin not on
  the `ALLOWED_ORIGINS` allowlist.
- `429 { "error": "..." }` - this IP has exceeded 5 submissions in the last hour.
- `502 { "error": "Failed to submit feedback" }` - Trello API call failed.

CORS: only `POST` and `OPTIONS` are allowed. Preflight `OPTIONS` requests are
handled directly. `Access-Control-Allow-Origin` is only set when the request's
`Origin` header matches an entry in `ALLOWED_ORIGINS` (see wrangler.toml).

## One-time setup (Ben runs these himself)

This repo has never had Wrangler installed, so start there.

1. **Install Wrangler.** Either install it globally or just use `npx` each time:
   ```
   npm install -g wrangler
   ```
   (or skip this and prefix every command below with `npx`, e.g. `npx wrangler dev`)

2. **Log in to Cloudflare:**
   ```
   wrangler login
   ```
   This opens a browser window to authorize Wrangler against your Cloudflare account.

3. **Create the KV namespace used for rate limiting:**
   ```
   cd worker
   wrangler kv namespace create RATE_LIMIT_KV
   ```
   This prints an `id`. Open `wrangler.toml` and paste it into the `[[kv_namespaces]]`
   block, replacing the `<replace-with-kv-namespace-id-from-wrangler-kv-namespace-create>`
   placeholder. If you also want a separate namespace for local `wrangler dev` testing,
   run `wrangler kv namespace create RATE_LIMIT_KV --preview` and paste that id into
   `preview_id` (otherwise you can reuse the same id for both).

4. **Mint a Trello API key + token** scoped to the Foothold board:
   - Get an API key at https://trello.com/app-key (while logged in as the account
     that owns/has access to the "Foothold" board).
   - Generate a token from that same page (or via the "Token" link next to your key) -
     make sure it has read/write scope.
   - Set them as Worker secrets (never put these in wrangler.toml or commit them):
     ```
     wrangler secret put TRELLO_KEY
     wrangler secret put TRELLO_TOKEN
     ```
     Wrangler will prompt you to paste each value.

5. **Set the real allowed origins.** Edit `ALLOWED_ORIGINS` in `wrangler.toml` once
   the itch.io page is live, e.g.:
   ```
   ALLOWED_ORIGINS = "https://benzur.itch.io,http://localhost:8123,http://localhost:8080"
   ```
   (Keep the localhost entries for local dev testing.)

6. **Deploy:**
   ```
   npm run deploy
   ```
   (or `wrangler deploy` directly)

## Local testing

```
cd worker
npm install
npm run dev
```

This starts `wrangler dev`, which by default serves on `http://localhost:8787`.
It will still call the real Trello API using whatever secrets you've configured
(secrets set with `wrangler secret put` are available in `wrangler dev` too), so
test submissions will create real cards on the board unless you temporarily point
`idList` somewhere else.

Example test POST (adjust the Origin header to one in your `ALLOWED_ORIGINS` list):

```bash
curl -X POST http://localhost:8787/ \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8123" \
  -d '{"type":"Bug","message":"Test card from curl","hp":""}'
```

Expected: `{"ok":true}` and a new card on the "Cloudflare Worker" list on the
Foothold Trello board, labeled "Beta Feedback" + "Bug".

## Trello destination (fixed, not user-configurable)

- Board: **Foothold** (`6a5561e77bb31280a2ad8750`)
- List: **Cloudflare Worker** - intake lane for all feedback-form submissions
  (`6a5564f4557bda36272cade9`)
- Labels applied: **Beta Feedback** (always) + **Bug** or **Suggestion** depending on
  the submitted `type`.

These IDs live in `wrangler.toml` under `[vars.trello]` - they are not secret, so
they're safe to keep in plain config.
