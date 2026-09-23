importScripts('parse.js');

const DEFAULT_SETTINGS = {
  nearAhead: 200, // alert when this many (or fewer) people are ahead
  nearMinutes: 3, // ...or when the estimate drops to this many minutes
  sound: true,
  ntfyServer: 'https://ntfy.sh',
  ntfyTopic: '', // phone push via the free ntfy app; empty = off
};
const MAX_SAMPLES = 240;

// ---------- state (kept in session storage so it survives the worker sleeping) ----------

let queue = Promise.resolve();
// Serialise every read-modify-write so snapshots arriving together don't clobber each other.
function withState(fn) {
  const run = queue.then(async () => {
    const { tabs = {} } = await chrome.storage.session.get('tabs');
    const result = await fn(tabs);
    await chrome.storage.session.set({ tabs });
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

const isQueueItHost = (url) => {
  try {
    return /(^|\.)queue-it\.net$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

// ---------- alerts ----------

async function playSound(urgent) {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'src/offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play an alert when you reach the front of a ticket queue',
    });
  }
  await chrome.runtime.sendMessage({ target: 'offscreen', type: 'play', urgent });
}

async function pushToPhone(settings, title, message, urgent) {
  if (!settings.ntfyTopic) return;
  const server = settings.ntfyServer.replace(/\/+$/, '');
  try {
    await fetch(`${server}/${encodeURIComponent(settings.ntfyTopic)}`, {
      method: 'POST',
      body: message,
      headers: {
        Title: title,
        Priority: urgent ? 'urgent' : 'high',
        Tags: urgent ? 'rotating_light,ticket' : 'hourglass,ticket',
      },
    });
  } catch (e) {
    console.warn('QueueMate: phone push failed', e);
  }
}

async function alertUser(tabId, title, message, urgent) {
  const settings = await getSettings();
  chrome.notifications.create(`tab-${tabId}-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message,
    priority: 2,
    requireInteraction: urgent,
  });
  if (settings.sound) playSound(urgent).catch((e) => console.warn('QueueMate: sound failed', e));
  pushToPhone(settings, title, message, urgent);
}

chrome.notifications.onClicked.addListener(async (id) => {
  const m = id.match(/^tab-(\d+)-/);
  if (!m) return;
  const tabId = Number(m[1]);
  try {
    const tab = await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch {
    // Tab is gone; nothing to focus.
  }
  chrome.notifications.clear(id);
});

// ---------- badge ----------

function shortCount(n) {
  if (n == null) return '…';
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function updateBadge(tabId, entry) {
  if (!entry) {
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }
  const turn = entry.status === 'turn';
  chrome.action.setBadgeText({ tabId, text: turn ? 'GO' : shortCount(entry.ahead ?? entry.position) });
  chrome.action.setBadgeBackgroundColor({ tabId, color: turn ? '#16a34a' : '#4f46e5' });
}

// ---------- queue tracking ----------

async function markTurn(tabId, tabs) {
  const entry = tabs[tabId];
  if (!entry || entry.status === 'turn') return;
  entry.status = 'turn';
  entry.turnAt = Date.now();
  updateBadge(tabId, entry);
  await alertUser(
    tabId,
    "🎟️ It's your turn!",
    `You're through the queue for ${entry.title || entry.host}. Go and finish checkout now.`,
    true
  );
}

async function handleSnapshot(tabId, { snapshot, url, title }) {
  const settings = await getSettings();
  await withState(async (tabs) => {
    let entry = tabs[tabId];

    if (!entry) {
      if (!snapshot.inQueue) return;
      entry = tabs[tabId] = {
        startedAt: Date.now(),
        samples: [],
        status: 'queue',
        nearAlerted: false,
        misses: 0,
      };
      // Stop Chrome from discarding the tab to save memory, which would lose your place.
      chrome.tabs.update(tabId, { autoDiscardable: false }).catch(() => {});
    }

    entry.url = url;
    entry.title = title;
    try {
      entry.host = new URL(url).hostname;
    } catch {
      entry.host = url;
    }
    if (entry.status === 'turn') {
      updateBadge(tabId, entry); // Chrome clears per-tab badges on navigation
      return;
    }

    if (snapshot.yourTurn) {
      await markTurn(tabId, tabs);
      return;
    }

    if (!snapshot.inQueue) {
      // Two quiet reads in a row (10s) means the queue page is gone and we've been let in.
      entry.misses += 1;
      if (entry.misses >= 2) await markTurn(tabId, tabs);
      return;
    }
    entry.misses = 0;

    entry.ahead = snapshot.ahead;
    entry.position = snapshot.position;
    entry.progress = snapshot.progress;
    entry.waitText = snapshot.waitText;
    entry.samples.push({ t: Date.now(), ahead: snapshot.ahead });
    if (entry.samples.length > MAX_SAMPLES) entry.samples.splice(0, entry.samples.length - MAX_SAMPLES);
    entry.rate = QueueParse.servedPerMinute(entry.samples);
    entry.etaMinutes = QueueParse.estimateMinutes(entry.samples, snapshot.waitMinutes);
    updateBadge(tabId, entry);

    const near =
      (entry.ahead != null && entry.ahead <= settings.nearAhead) ||
      (entry.etaMinutes != null && entry.etaMinutes <= settings.nearMinutes);
    if (near && !entry.nearAlerted) {
      entry.nearAlerted = true;
      const detail = entry.ahead != null ? `${entry.ahead.toLocaleString()} people ahead` : 'nearly there';
      const eta = entry.etaMinutes != null ? `, about ${entry.etaMinutes} min` : '';
      await alertUser(tabId, '⏳ Almost your turn', `${detail}${eta}. Get back to your computer.`, false);
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === 'offscreen') return;
  if (msg?.type === 'snapshot' && sender.tab) {
    handleSnapshot(sender.tab.id, msg);
    return;
  }
  if (msg?.type === 'test-alert') {
    alertUser(-1, '🔔 QueueMate test', 'Alerts are working. You will hear and see this when your turn comes.', false)
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'stop-watching') {
    withState((tabs) => {
      delete tabs[msg.tabId];
      updateBadge(msg.tabId, null);
      chrome.tabs.update(msg.tabId, { autoDiscardable: true }).catch(() => {});
    }).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Queue-it hands you back to the ticket site with a redirect; catch that even on sites the
// content script doesn't run on.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  withState(async (tabs) => {
    const entry = tabs[tabId];
    if (entry && entry.status === 'queue' && isQueueItHost(entry.url) && !isQueueItHost(changeInfo.url)) {
      entry.url = changeInfo.url;
      await markTurn(tabId, tabs);
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  withState(async (tabs) => {
    const entry = tabs[tabId];
    if (!entry) return;
    delete tabs[tabId];
    if (entry.status === 'queue') {
      await alertUser(
        tabId,
        '⚠️ Queue tab closed',
        `You closed the queue tab for ${entry.title || entry.host}. You may have lost your place in line.`,
        true
      );
    }
  });
});
