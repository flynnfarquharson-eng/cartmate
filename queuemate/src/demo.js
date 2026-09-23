// A fake Queue-it style waiting room that drains in about 4 minutes, so alerts can be
// tried without a real on-sale. It uses the same element ids as the real thing.
(function () {
  const START = 2400;
  const DURATION_MS = 4 * 60 * 1000;
  const started = Date.now();
  const ahead = document.getElementById('MainPart_lbUsersInLineAheadOfYou');
  const bar = document.getElementById('MainPart_divProgressbar');
  const wait = document.getElementById('MainPart_lbExpectedServiceTime');

  function tick() {
    const done = Math.min(1, (Date.now() - started) / DURATION_MS);
    const left = Math.round(START * (1 - done));
    ahead.textContent = left.toLocaleString();
    bar.style.width = `${Math.round(done * 100)}%`;
    const secs = Math.round((DURATION_MS * (1 - done)) / 1000);
    wait.textContent = secs > 60 ? `${Math.ceil(secs / 60)} minutes` : 'less than a minute';
    if (done >= 1) {
      clearInterval(timer);
      document.getElementById('queue').remove();
      document.getElementById('done').hidden = false;
    }
  }
  const timer = setInterval(tick, 1000);
  tick();
})();
