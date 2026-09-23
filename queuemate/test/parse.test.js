const test = require('node:test');
const assert = require('node:assert');
const Q = require('../src/parse.js');

// Minimal stand-in for `document`.
function fakeDoc({ text = '', ids = {}, host = 'example.com' }) {
  return {
    location: { hostname: host },
    body: { innerText: text },
    getElementById: (id) => (id in ids ? ids[id] : null),
  };
}

test('reads Queue-it waiting room elements', () => {
  const doc = fakeDoc({
    host: 'ticketmasterau.queue-it.net',
    text: 'You are now in line.',
    ids: {
      MainPart_lbUsersInLineAheadOfYou: { textContent: '12,345' },
      MainPart_lbQueueNumber: { textContent: '67890' },
      MainPart_lbExpectedServiceTime: { textContent: '25 minutes' },
      MainPart_divProgressbar: { textContent: '', style: { width: '42%' } },
    },
  });
  const s = Q.readQueue(doc);
  assert.equal(s.inQueue, true);
  assert.equal(s.ahead, 12345);
  assert.equal(s.position, 67890);
  assert.equal(s.waitMinutes, 25);
  assert.equal(s.progress, 42);
  assert.equal(s.yourTurn, false);
});

test('falls back to page text on unknown sites', () => {
  const s = Q.readQueue(fakeDoc({ text: 'There are 1,204 people ahead of you.\nEstimated wait time: 1 hour 5 minutes' }));
  assert.equal(s.inQueue, true);
  assert.equal(s.ahead, 1204);
  assert.equal(s.waitMinutes, 65);
});

test('detects your turn', () => {
  const s = Q.readQueue(fakeDoc({ host: 'x.queue-it.net', text: "It's your turn! You are being redirected" }));
  assert.equal(s.yourTurn, true);
});

test('ordinary pages are not queues', () => {
  const s = Q.readQueue(fakeDoc({ text: 'Taylor Swift | Eras Tour | Buy tickets' }));
  assert.equal(s.inQueue, false);
});

test('parses wait strings', () => {
  assert.equal(Q.parseWaitMinutes('More than an hour'), 60);
  assert.equal(Q.parseWaitMinutes('less than a minute'), 1);
  assert.equal(Q.parseWaitMinutes('2 hours'), 120);
  const now = new Date(2026, 0, 1, 14, 0);
  assert.equal(Q.parseWaitMinutes('14:32', now), 32);
  assert.equal(Q.parseWaitMinutes('2:10 PM', now), 10);
  assert.equal(Q.parseWaitMinutes('soon'), null);
});

test('measures queue speed and estimates time left', () => {
  const t0 = 1_000_000;
  // 100 people served per minute, sampled every 30s.
  const samples = Array.from({ length: 11 }, (_, i) => ({ t: t0 + i * 30_000, ahead: 5000 - i * 50 }));
  assert.equal(Math.round(Q.servedPerMinute(samples)), 100);
  assert.equal(Q.estimateMinutes(samples, 99), 45); // 4500 left / 100 per min
});

test('uses the site estimate when the queue is not moving', () => {
  const samples = [{ t: 0, ahead: 500 }, { t: 60_000, ahead: 500 }];
  assert.equal(Q.servedPerMinute(samples), null);
  assert.equal(Q.estimateMinutes(samples, 12), 12);
});

test('ignores speed until there is a minute of history', () => {
  const samples = [{ t: 0, ahead: 1000 }, { t: 5_000, ahead: 900 }];
  assert.equal(Q.servedPerMinute(samples), null);
  assert.equal(Q.estimateMinutes(samples, 30), 30);
});
