// Pure validators shared by functions/api/*.js
// No side effects, no Cloudflare bindings — safe to import from any handler.

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const TOPIC_TEXT_MIN = 1;
const TOPIC_TEXT_MAX = 200;
const CATEGORY_MIN = 1;
const CATEGORY_MAX = 40;
// 2024-01-01T00:00:00Z — earliest plausible client build timestamp.
const TIMESTAMP_FLOOR_MS = 1704067200000;

export function validateDeviceId(s) {
  return typeof s === 'string' && DEVICE_ID_RE.test(s);
}

export function validateTopic(t) {
  if (typeof t !== 'object' || t === null) {
    return { ok: false, reason: 'invalid' };
  }

  if (typeof t.text !== 'string') {
    return { ok: false, reason: 'invalid' };
  }
  const trimmedText = t.text.trim();
  if (trimmedText.length < TOPIC_TEXT_MIN || trimmedText.length > TOPIC_TEXT_MAX) {
    return { ok: false, reason: 'invalid' };
  }

  if (typeof t.category !== 'string') {
    return { ok: false, reason: 'invalid' };
  }
  const trimmedCategory = t.category.trim();
  if (trimmedCategory.length < CATEGORY_MIN || trimmedCategory.length > CATEGORY_MAX) {
    return { ok: false, reason: 'invalid' };
  }

  if (typeof t.color !== 'string' || !COLOR_RE.test(t.color)) {
    return { ok: false, reason: 'invalid' };
  }

  if (!Number.isInteger(t.timestamp)) {
    return { ok: false, reason: 'invalid' };
  }
  const ceiling = Date.now() + 60_000;
  if (t.timestamp < TIMESTAMP_FLOOR_MS || t.timestamp > ceiling) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true };
}
