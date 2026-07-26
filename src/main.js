import './style.css';

// --- shared contract: keep in sync with functions/api/_validators.js ---
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const HISTORY_MAX = 20;
const RECENT_LIMIT = 3;
const HISTORY_KEY = 'talkGachaHistory';
const DEVICE_KEY = 'talkGachaDeviceId';

// Throttle warn-once to console spam.
const warnedCategoryIds = new Set();
const warnedColors = new Set();

const state = {
  topics: [],
  categories: [],
  history: loadHistory(),
  recentIds: [],
  spinning: false,
  deviceId: getOrCreateDeviceId(),
};

const els = {
  card: document.getElementById('roulette-card'),
  categoryBadge: document.getElementById('category-badge'),
  topicText: document.getElementById('topic-text'),
  tags: document.getElementById('tags'),
  spinBtn: document.getElementById('spin-btn'),
  resetBtn: document.getElementById('reset-btn'),
  historyList: document.getElementById('history-list'),
};

// --- helpers -------------------------------------------------------------

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPlausibleHistoryEntry) : [];
  } catch (_e) {
    return [];
  }
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  } catch (e) {
    console.warn('localStorage write failed', e);
  }
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (id && DEVICE_ID_RE.test(id)) return id;
  id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

function isPlausibleHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.text !== 'string' || entry.text.length === 0) return false;
  if (typeof entry.timestamp !== 'number' || !Number.isFinite(entry.timestamp)) return false;
  return true;
}

function sanitizeColor(candidate) {
  if (typeof candidate !== 'string' || !COLOR_RE.test(candidate)) return null;
  return candidate;
}

function lookupCategory(id) {
  const found = state.categories.find((c) => c && c.id === id);
  if (found) return found;
  if (!warnedCategoryIds.has(id)) {
    warnedCategoryIds.add(id);
    console.warn(`Unknown category id: ${JSON.stringify(id)}`);
  }
  return { id: id || 'unknown', name: 'その他', color: '#888888' };
}

// Apply a colour via CSS variables only — never inline user-supplied strings.
function setTone(el, color) {
  if (!el || !color) return;
  if (!COLOR_RE.test(color)) {
    if (!warnedColors.has(color)) {
      warnedColors.add(color);
      console.warn('Rejected non-hex color for tone:', color);
    }
    return;
  }
  el.style.setProperty('--badge-color', color);
  el.style.setProperty('--topic-color', color);
}

function clearTone() {
  els.categoryBadge.style.removeProperty('--badge-color');
  els.topicText.style.removeProperty('--topic-color');
}

function getRandomTopic(excludeIds) {
  if (!state.topics.length) return null;
  const exclude = excludeIds && excludeIds.length ? excludeIds : null;
  if (exclude && exclude.length >= state.topics.length) {
    // pool smaller than exclusions — bail without exclusion.
    return state.topics[Math.floor(Math.random() * state.topics.length)];
  }
  const candidates = exclude
    ? state.topics.filter((t) => !exclude.includes(t.id))
    : state.topics;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function pushRecent(id) {
  if (id == null) return;
  state.recentIds = [id, ...state.recentIds.filter((x) => x !== id)].slice(0, RECENT_LIMIT);
}

// --- rendering -----------------------------------------------------------

function renderTags(tags) {
  els.tags.replaceChildren();
  if (!Array.isArray(tags)) return;
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.length === 0) continue;
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = `#${tag}`;
    els.tags.appendChild(span);
  }
}

function updateCard(topic, category) {
  const cat = category || lookupCategory(topic.category);
  els.categoryBadge.textContent = cat.name;
  if (sanitizeColor(cat.color)) {
    setTone(els.card, cat.color);
  }
  els.topicText.textContent = topic.text;
  renderTags(topic.tags);
}

function renderHistory() {
  const list = els.historyList;
  list.replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'まだ話題が出題されていません';
    list.appendChild(empty);
    return;
  }
  for (const item of state.history) {
    list.appendChild(renderHistoryItem(item));
  }
}

function renderHistoryItem(item) {
  const row = document.createElement('div');
  row.className = 'history-item';

  const icon = document.createElement('div');
  icon.className = 'icon';
  icon.textContent = '💬';

  const content = document.createElement('div');
  content.className = 'content';

  const topic = document.createElement('div');
  topic.className = 'topic';
  topic.textContent = item.text;

  const category = document.createElement('div');
  category.className = 'category';
  category.textContent = item.category;

  const safe = sanitizeColor(item.color);
  if (safe) {
    category.style.setProperty('--history-color', safe);
    // ensure the CSS rule consumes var(--history-color, currentColor).
  }

  content.append(topic, category);
  row.append(icon, content);
  return row;
}

// --- history mgmt --------------------------------------------------------

function mergeHistory(local, kv) {
  const byKey = new Map();
  const keyOf = (h) =>
    typeof h.text === 'string' ? h.text.trim().toLowerCase() : '';

  for (const h of local) {
    const key = keyOf(h);
    if (!key) continue;
    const prior = byKey.get(key);
    if (!prior || (prior.timestamp || 0) < (h.timestamp || 0)) {
      byKey.set(key, h);
    }
  }
  for (const h of kv) {
    if (!isPlausibleHistoryEntry(h)) continue;
    const key = keyOf(h);
    if (!key) continue;
    const prior = byKey.get(key);
    if (!prior || (prior.timestamp || 0) < (h.timestamp || 0)) {
      byKey.set(key, h);
    }
  }
  const merged = Array.from(byKey.values()).sort((a, b) =>
    (b.timestamp || 0) - (a.timestamp || 0)
  );
  return merged.slice(0, HISTORY_MAX);
}

async function addToHistory(topic) {
  const category = lookupCategory(topic.category);
  const safeColor = sanitizeColor(category.color) || '#888888';
  const entry = {
    text: topic.text,
    category: category.name,
    categoryId: category.id,
    color: safeColor,
    tags: Array.isArray(topic.tags) ? topic.tags.slice(0, 10) : [],
    timestamp: Date.now(),
  };

  state.history = [entry, ...state.history].slice(0, HISTORY_MAX);
  persistHistory();
  renderHistory();

  try {
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: state.deviceId, topic: entry }),
    });
    if (!res.ok) {
      // Server rejected (e.g. validation). Keep local copy; do nothing more.
      console.warn('history POST non-ok status', res.status);
    }
  } catch (e) {
    console.warn('history POST failed', e);
  }
}

async function reset() {
  if (state.spinning) return;
  if (!confirm('履歴をすべて削除しますか？（この端末とサーバーから削除されます）')) return;

  state.history = [];
  state.recentIds = [];
  localStorage.removeItem(HISTORY_KEY);
  // Keep the device_id so the server-side per-device KV can be wiped.

  clearTone();
  els.categoryBadge.textContent = 'カテゴリー';
  els.categoryBadge.style.background = '';
  els.topicText.textContent = '話題を表示します';
  els.topicText.style.color = '';
  renderTags([]);
  renderHistory();

  try {
    const url = `/api/history?device_id=${encodeURIComponent(state.deviceId)}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) console.warn('history DELETE non-ok status', res.status);
  } catch (e) {
    console.warn('history DELETE failed', e);
  }
}

async function fetchTopics() {
  const res = await fetch('/api/topics');
  if (!res.ok) throw new Error(`topics not ok: ${res.status}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.categories) || !Array.isArray(data.topics)) {
    throw new Error('topics payload malformed');
  }
  state.categories = data.categories;
  state.topics = data.topics;
}

async function loadHistoryFromKV() {
  const url = `/api/history?device_id=${encodeURIComponent(state.deviceId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`history not ok: ${res.status}`);
  }
  const kv = await res.json();
  if (!Array.isArray(kv)) {
    throw new Error('history payload malformed');
  }
  state.history = mergeHistory(state.history, kv);
  persistHistory();
}

async function init() {
  let topicsFailed = false;
  try {
    await fetchTopics();
  } catch (e) {
    topicsFailed = true;
    console.error('Failed to load topics:', e);
    els.topicText.textContent = '話題データの読み込みに失敗しました 😢';
  }

  try {
    await loadHistoryFromKV();
  } catch (e) {
    console.warn('History sync failed, keeping local only:', e);
  }

  renderHistory();

  if (state.topics.length) {
    // show a starter topic so the card isn't blank before the first spin.
    const initial = getRandomTopic();
    if (initial) {
      const category = lookupCategory(initial.category);
      updateCard(initial, category);
      pushRecent(initial.id);
    }
  }

  if (topicsFailed) {
    // keep the error visible on the card; nothing else to do.
  }
}

// --- spin / reset --------------------------------------------------------

function stepSpin(current, spinCount, baseDelay) {
  const topic = getRandomTopic(state.recentIds);
  if (topic) {
    updateCard(topic);
    pushRecent(topic.id);
  }

  if (current + 1 < spinCount) {
    const delay = baseDelay + ((current + 1) * (current + 1)) / 3;
    setTimeout(() => stepSpin(current + 1, spinCount, baseDelay), delay);
    return;
  }
  const finalTopic = getRandomTopic(state.recentIds);
  if (finalTopic) {
    updateCard(finalTopic);
    pushRecent(finalTopic.id);
    addToHistory(finalTopic);
  }
  state.spinning = false;
  els.spinBtn.disabled = false;
  els.card.classList.remove('spinning');
}

function spin() {
  if (state.spinning || !state.topics.length) return;
  state.spinning = true;
  els.spinBtn.disabled = true;
  els.card.classList.add('spinning');
  stepSpin(0, 20, 80);
}


// --- wire ----------------------------------------------------------------

els.spinBtn.addEventListener('click', spin);
els.resetBtn.addEventListener('click', reset);

init();
