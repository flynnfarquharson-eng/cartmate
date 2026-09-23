// Pure helpers shared by the content script, the service worker and the tests.
// Nothing in here touches the page beyond reading it.
(function (root) {
  function toInt(text) {
    if (text == null) return null;
    const digits = String(text).replace(/[^\d]/g, '');
    return digits ? parseInt(digits, 10) : null;
  }

  // Queue-it (used by Ticketmaster, Ticketek, AXS and most big sellers) renders
  // these element ids on its waiting room page.
  const QUEUE_IT_IDS = {
    ahead: 'MainPart_lbUsersInLineAheadOfYou',
    queueNumber: 'MainPart_lbQueueNumber',
    expected: 'MainPart_lbExpectedServiceTime',
    progress: 'MainPart_divProgressbar',
  };

  const AHEAD_PATTERNS = [
    /([\d,. ]+)\s+(?:people|users|fans|customers|others)\s+(?:are\s+)?(?:ahead|in (?:line|the queue) (?:ahead|before) (?:of )?you)/i,
    /(?:ahead of you|in front of you)\s*[:\-]?\s*([\d,. ]+)/i,
    /number of (?:users|people) (?:in line )?ahead of you\s*[:\-]?\s*([\d,. ]+)/i,
  ];
  const POSITION_PATTERNS = [
    /(?:your (?:place|position|number) in (?:line|the queue)|queue (?:number|position))\s*(?:is)?\s*[:#\-]?\s*([\d,. ]+)/i,
    /you are (?:number|#)\s*([\d,. ]+)\s+in (?:line|the queue)/i,
  ];
  const WAIT_PATTERNS = [
    /(?:estimated|expected)\s+(?:wait(?:ing)?\s+)?time\s*[:\-]?\s*(?:is\s+)?(?:about\s+|approx\.?\s+)?([^\n.]{1,40})/i,
    /(?:wait(?:ing)? time)\s*[:\-]?\s*(?:is\s+)?(?:about\s+|approx\.?\s+)?([^\n.]{1,40})/i,
  ];
  const TURN_PATTERNS = [
    /it'?s your turn/i,
    /you(?:'re| are) (?:now )?(?:being )?(?:redirected|through)/i,
  ];
  const WAITING_ROOM_PATTERNS = [
    /waiting room/i,
    /you are (?:now )?in (?:the )?(?:line|queue)/i,
    /(?:don'?t|do not) (?:refresh|close) (?:this|the) (?:page|window|tab)/i,
  ];

  function firstMatch(patterns, text) {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return m[1];
    }
    return null;
  }

  // "12 minutes", "1 hour 5 min", "More than an hour", "14:32" -> minutes (or null)
  function parseWaitMinutes(text, now = new Date()) {
    if (!text) return null;
    const t = String(text).toLowerCase();
    if (/more than an hour/.test(t)) return 60;
    if (/less than a minute/.test(t)) return 1;
    let minutes = 0;
    let found = false;
    const h = t.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)\b/);
    const m = t.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/);
    if (h) { minutes += parseInt(h[1], 10) * 60; found = true; }
    if (m) { minutes += parseInt(m[1], 10); found = true; }
    if (found) return minutes;
    // Clock time: "expected at 14:32" / "2:32 PM"
    const clock = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
    if (clock) {
      let hour = parseInt(clock[1], 10);
      const min = parseInt(clock[2], 10);
      if (clock[3] === 'pm' && hour < 12) hour += 12;
      if (clock[3] === 'am' && hour === 12) hour = 0;
      const target = new Date(now);
      target.setHours(hour, min, 0, 0);
      let diff = (target - now) / 60000;
      if (diff < -60) diff += 24 * 60;
      return Math.max(0, Math.round(diff));
    }
    return null;
  }

  // Reads a snapshot of the queue from a document-like object.
  // Returns { inQueue, ahead, position, waitText, waitMinutes, progress, yourTurn }.
  function readQueue(doc, now = new Date()) {
    const byId = (id) => (doc.getElementById ? doc.getElementById(id) : null);
    const text = (doc.body && (doc.body.innerText || doc.body.textContent)) || '';
    const host = (doc.location && doc.location.hostname) || '';

    let ahead = toInt(byId(QUEUE_IT_IDS.ahead)?.textContent);
    let position = toInt(byId(QUEUE_IT_IDS.queueNumber)?.textContent);
    let waitText = byId(QUEUE_IT_IDS.expected)?.textContent?.trim() || null;
    let progress = null;
    const bar = byId(QUEUE_IT_IDS.progress);
    if (bar && bar.style && bar.style.width) {
      const pct = parseFloat(bar.style.width);
      if (!Number.isNaN(pct)) progress = Math.min(100, Math.max(0, pct));
    }

    if (ahead == null) ahead = toInt(firstMatch(AHEAD_PATTERNS, text));
    if (position == null) position = toInt(firstMatch(POSITION_PATTERNS, text));
    if (!waitText) waitText = firstMatch(WAIT_PATTERNS, text)?.trim() || null;

    const yourTurn = TURN_PATTERNS.some((re) => re.test(text));
    const inQueue =
      /queue-it\.net$/.test(host) ||
      ahead != null ||
      position != null ||
      WAITING_ROOM_PATTERNS.some((re) => re.test(text));

    return {
      inQueue,
      ahead,
      position,
      waitText,
      waitMinutes: parseWaitMinutes(waitText, now),
      progress,
      yourTurn,
    };
  }

  // Least-squares slope of "people ahead" over time, using recent samples.
  // samples: [{ t: ms, ahead: number }]. Returns people served per minute (or null).
  // Needs at least minSpanMs of history so a couple of jittery reads can't fake a fast queue.
  function servedPerMinute(samples, windowMs = 10 * 60 * 1000, minSpanMs = 60 * 1000) {
    const pts = samples.filter((s) => s.ahead != null);
    if (pts.length < 2) return null;
    const latest = pts[pts.length - 1].t;
    const recent = pts.filter((s) => latest - s.t <= windowMs);
    if (recent.length < 2 || latest - recent[0].t < minSpanMs) return null;
    const n = recent.length;
    const xs = recent.map((s) => (s.t - recent[0].t) / 60000);
    const ys = recent.map((s) => s.ahead);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    if (den === 0) return null;
    const rate = -num / den;
    return rate > 0 ? rate : null;
  }

  // Best estimate of minutes left: our own measured rate first, the page's figure otherwise.
  function estimateMinutes(samples, pageMinutes) {
    const last = [...samples].reverse().find((s) => s.ahead != null);
    const rate = servedPerMinute(samples);
    if (last && rate) return Math.max(0, Math.round(last.ahead / rate));
    return pageMinutes ?? null;
  }

  const api = { toInt, parseWaitMinutes, readQueue, servedPerMinute, estimateMinutes, QUEUE_IT_IDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QueueParse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
