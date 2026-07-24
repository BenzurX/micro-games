// feedback.js: submits the Settings ▸ Feedback form to the Cloudflare Worker backend, which
// turns it into a Trello card for manual triage (see /worker in this repo). Kept separate from
// ui.js so the network/validation logic isn't tangled up with the popup's Phaser/DOM building.

export const FEEDBACK_ENDPOINT = 'https://foothold-feedback.benzur.workers.dev';

// type: 'Bug' | 'Suggestion', message: string (already trimmed/non-empty - caller's job to check).
// hp: the honeypot field's raw value (should always be '' from a real player - see ui.js).
// Returns { ok: true } or { ok: false, error: string } - never throws, so the UI can always show
// a simple success/failure state without a try/catch at the call site.
export async function submitFeedback({ type, message, hp = '' }) {
  if (!FEEDBACK_ENDPOINT) {
    console.warn('[feedback] FEEDBACK_ENDPOINT is not set - submission dropped:', { type, message });
    return { ok: false, error: "Feedback isn't connected yet - try again later." };
  }
  try {
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, hp }),
    });
    if (!res.ok) return { ok: false, error: `Server error (${res.status}). Try again later.` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Couldn't reach the server - check your connection." };
  }
}
