// Reads the queue page every few seconds and reports it to the service worker.
// Read-only: it never clicks, refreshes, or fills anything in.
(function () {
  if (window.__queuemateActive) return;
  window.__queuemateActive = true;

  let lastSent = '';
  let scheduled = false;

  // The 5s tick always reports so the worker can measure queue speed; page changes in
  // between only report when something visible actually changed.
  function report(always) {
    let snapshot;
    try {
      snapshot = QueueParse.readQueue(document);
    } catch (e) {
      return;
    }
    const key = JSON.stringify(snapshot);
    if (!always && key === lastSent) return;
    lastSent = key;
    chrome.runtime
      .sendMessage({ type: 'snapshot', snapshot, url: location.href, title: document.title })
      .catch(() => {});
  }

  setInterval(() => report(true), 5000);
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      report(false);
    }, 750);
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  report(true);
})();
