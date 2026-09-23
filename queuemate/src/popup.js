const $ = (sel) => document.querySelector(sel);

function formatMinutes(m) {
  if (m == null) return '–';
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

async function render() {
  const { tabs = {} } = await chrome.storage.session.get('tabs');
  const list = $('#queues');
  list.replaceChildren();
  const entries = Object.entries(tabs).sort(([, a], [, b]) => (a.status === 'turn' ? -1 : 0) - (b.status === 'turn' ? -1 : 0));
  $('#empty').hidden = entries.length > 0;

  for (const [tabId, e] of entries) {
    const node = $('#card').content.firstElementChild.cloneNode(true);
    const turn = e.status === 'turn';
    node.classList.toggle('turn', turn);
    node.querySelector('.title').textContent = e.title || e.host;
    node.querySelector('.status').textContent = turn
      ? "It's your turn! Finish checkout now."
      : `In queue for ${formatMinutes(Math.round((Date.now() - e.startedAt) / 60000))}${e.waitText ? ` · site says ${e.waitText}` : ''}`;
    node.querySelector('.fill').style.width = `${turn ? 100 : e.progress ?? 0}%`;
    node.querySelector('.ahead').textContent = turn ? '0' : e.ahead?.toLocaleString() ?? (e.position ? `#${e.position.toLocaleString()}` : '–');
    node.querySelector('.eta').textContent = turn ? 'Now' : formatMinutes(e.etaMinutes);
    node.querySelector('.rate').textContent = e.rate ? `${Math.round(e.rate).toLocaleString()}/min` : '–';
    node.querySelector('.go').addEventListener('click', async () => {
      const tab = await chrome.tabs.update(Number(tabId), { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      window.close();
    });
    node.querySelector('.stop').addEventListener('click', () =>
      chrome.runtime.sendMessage({ type: 'stop-watching', tabId: Number(tabId) }).then(render)
    );
    list.append(node);
  }
}

// For queue pages on sites QueueMate doesn't know about.
$('#watch').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/parse.js'],
    }).then(() =>
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => QueueParse.readQueue(document),
      })
    );
    if (!result?.inQueue) {
      $('#msg').textContent = "Couldn't find a queue on this page. Try again once the waiting room shows your position.";
      return;
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content.js'] });
    $('#msg').textContent = 'Watching this tab ✓';
  } catch (e) {
    $('#msg').textContent = `Can't watch this tab: ${e.message}`;
  }
});

$('#test').addEventListener('click', () =>
  chrome.runtime.sendMessage({ type: 'test-alert' }).then(() => ($('#msg').textContent = 'Test alert sent.'))
);

$('#demo').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('src/demo.html') }));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.tabs) render();
});
render();
