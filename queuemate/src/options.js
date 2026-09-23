const FIELDS = { nearAhead: 200, nearMinutes: 3, sound: true, ntfyServer: 'https://ntfy.sh', ntfyTopic: '' };
const el = (id) => document.getElementById(id);

chrome.storage.sync.get(FIELDS).then((s) => {
  for (const key of Object.keys(FIELDS)) {
    if (typeof FIELDS[key] === 'boolean') el(key).checked = s[key];
    else el(key).value = s[key];
  }
});

el('save').addEventListener('click', async () => {
  const s = {
    nearAhead: Math.max(0, Number(el('nearAhead').value) || 0),
    nearMinutes: Math.max(0, Number(el('nearMinutes').value) || 0),
    sound: el('sound').checked,
    ntfyServer: el('ntfyServer').value.trim() || FIELDS.ntfyServer,
    ntfyTopic: el('ntfyTopic').value.trim(),
  };
  // A self-hosted ntfy server needs its own host permission.
  const origin = `${new URL(s.ntfyServer).origin}/*`;
  if (origin !== 'https://ntfy.sh/*') {
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) {
      el('saved').textContent = 'Permission for that server was declined.';
      return;
    }
  }
  await chrome.storage.sync.set(s);
  el('saved').textContent = 'Saved ✓';
  setTimeout(() => (el('saved').textContent = ''), 2000);
});
