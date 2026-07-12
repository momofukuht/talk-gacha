import './style.css';

const state = {
  topics: [],
  categories: [],
  history: JSON.parse(localStorage.getItem('talkGachaHistory') || '[]'),
  spinning: false,
  deviceId: localStorage.getItem('talkGachaDeviceId') || (() => {
    const id = crypto.randomUUID();
    localStorage.setItem('talkGachaDeviceId', id);
    return id;
  })()
};

const els = {
  card: document.getElementById('roulette-card'),
  categoryBadge: document.getElementById('category-badge'),
  topicText: document.getElementById('topic-text'),
  tags: document.getElementById('tags'),
  spinBtn: document.getElementById('spin-btn'),
  resetBtn: document.getElementById('reset-btn'),
  historyList: document.getElementById('history-list')
};

async function init() {
  try {
    const [topicsRes, historyRes] = await Promise.all([
      fetch('/api/topics'),
      fetch(`/api/history?device_id=${encodeURIComponent(state.deviceId)}`)
    ]);
    const data = await topicsRes.json();
    state.categories = data.categories;
    state.topics = data.topics;

    if (historyRes.ok) {
      const kvHistory = await historyRes.json();
      const localHistory = state.history;
      const merged = mergeHistory(localHistory, kvHistory);
      state.history = merged;
      localStorage.setItem('talkGachaHistory', JSON.stringify(state.history));
    }
    renderHistory();
  } catch (e) {
    console.error('Failed to load:', e);
    els.topicText.textContent = '話題データの読み込みに失敗しました 😢';
  }
}

function mergeHistory(local, kv) {
  const seen = new Set(local.map(h => h.text + h.timestamp));
  const merged = [...local];
  for (const h of kv) {
    if (!seen.has(h.text + h.timestamp)) {
      merged.unshift(h);
      seen.add(h.text + h.timestamp);
    }
  }
  return merged.slice(0, 20);
}

function getCategory(id) {
  return state.categories.find(c => c.id === id) || { name: 'その他', color: '#888' };
}

function getRandomTopic() {
  if (!state.topics.length) return null;
  return state.topics[Math.floor(Math.random() * state.topics.length)];
}

function updateCard(topic) {
  const category = getCategory(topic.category);
  els.categoryBadge.textContent = category.name;
  els.categoryBadge.style.background = category.color;
  els.topicText.textContent = topic.text;
  els.topicText.style.color = category.color;

  els.tags.innerHTML = '';
  (topic.tags || []).forEach(tag => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = `#${tag}`;
    els.tags.appendChild(span);
  });
}

async function addToHistory(topic) {
  const category = getCategory(topic.category);
  const entry = {
    text: topic.text,
    category: category.name,
    color: category.color,
    timestamp: Date.now()
  };
  state.history.unshift(entry);
  if (state.history.length > 20) state.history.pop();
  localStorage.setItem('talkGachaHistory', JSON.stringify(state.history));
  renderHistory();

  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: state.deviceId,
        topic: entry,
        timestamp: entry.timestamp
      })
    });
  } catch (e) {
    console.error('Failed to sync history:', e);
  }
}

function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML = '<p class="empty">まだ話題が出題されていません</p>';
    return;
  }

  els.historyList.innerHTML = state.history.map(item => `
    <div class="history-item">
      <div class="icon">💬</div>
      <div class="content">
        <div class="topic">${escapeHtml(item.text)}</div>
        <div class="category" style="color: ${item.color}">${item.category}</div>
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function spin() {
  if (state.spinning || !state.topics.length) return;
  state.spinning = true;
  els.spinBtn.disabled = true;
  els.card.classList.add('spinning');

  const spinCount = 20;
  const baseDelay = 80;
  let current = 0;

  function step() {
    const topic = getRandomTopic();
    if (topic) updateCard(topic);

    current++;
    if (current < spinCount) {
      const delay = baseDelay + (current * current) / 3;
      setTimeout(step, delay);
    } else {
      const finalTopic = getRandomTopic();
      if (finalTopic) {
        updateCard(finalTopic);
        addToHistory(finalTopic);
      }
      state.spinning = false;
      els.spinBtn.disabled = false;
      els.card.classList.remove('spinning');
    }
  }

  step();
}

function reset() {
  if (state.spinning) return;
  if (!confirm('出勤履歴と保存データをリセットしますか？')) return;
  state.history = [];
  localStorage.removeItem('talkGachaHistory');
  renderHistory();
  els.categoryBadge.textContent = 'カテゴリー';
  els.categoryBadge.style.background = 'var(--accent)';
  els.topicText.textContent = '話題を表示します';
  els.topicText.style.color = '';
  els.tags.innerHTML = '';
}

els.spinBtn.addEventListener('click', spin);
els.resetBtn.addEventListener('click', reset);

init();