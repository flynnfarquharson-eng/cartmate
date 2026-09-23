# QueueMate 🎟️

A Chrome extension that watches your ticket queue so you don't have to stare at it.
Join the queue as normal, walk away, and QueueMate alerts you on your computer and your phone:

- **⏳ Almost your turn:** when few enough people are ahead of you, or the estimated wait is short (you set both limits)
- **🎟️ It's your turn:** when the queue lets you through to checkout
- **⚠️ Queue tab closed:** if the queue tab gets closed by accident

It also shows a live count of people ahead of you, how fast the queue is moving (measured by
QueueMate itself, not the site's guess), and a time estimate based on that speed.

## What it does *not* do

QueueMate only **reads** the queue page. It never refreshes, clicks, opens more tabs, gets around the
queue or buys anything. **You** still do the checkout. That keeps it within ticket sites' terms
and within anti-ticket-bot laws (NSW and Victoria in Australia, the US BOTS Act).

## Install (developer mode)

1. Open `chrome://extensions` in Chrome, Edge or Brave.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `queuemate/` folder.
4. Pin QueueMate to the toolbar, open the popup and press **Test alert**.

## Phone alerts

In **Settings** (⚙️ in the popup), enter an [ntfy](https://ntfy.sh) topic. Then install the free ntfy app
on your phone and subscribe to that same topic. Pick a hard-to-guess name, because anyone who knows the
topic can read the alerts.

## Supported sites

It picks up queues automatically on Queue-it waiting rooms (used by Ticketmaster, Ticketek, AXS and
many others) and on Ticketmaster, Ticketek, AXS, Live Nation, See Tickets, Oztix, Moshtix and Eventim.
For any other site, open the queue page and press **Watch this tab**.

## Tips

- Keep your computer plugged in and stop it from going to sleep.
- QueueMate stops Chrome from unloading the queue tab to save memory, but don't close it.
- One queue tab per account. Many sellers cancel orders from multiple queue entries.

## Development

```bash
npm test          # parser + queue-speed tests (Node 18+)
npm run icons     # regenerate icons/
npm run zip       # package for the Chrome Web Store
```

| File | Purpose |
|---|---|
| `src/parse.js` | Reads a queue page (Queue-it element ids with plain-text fallbacks) and estimates queue speed |
| `src/content.js` | Runs on queue pages and reports a snapshot every 5s |
| `src/background.js` | Tracks each queue tab, updates the icon badge, sends alerts |
| `src/offscreen.*` | Plays the alert chime (Manifest V3 service workers can't play audio) |
| `src/popup.*`, `src/options.*` | UI |
