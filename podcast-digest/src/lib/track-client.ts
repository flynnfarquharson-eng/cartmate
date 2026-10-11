/** Fire-and-forget click tracking from the browser. Never blocks or breaks the page. */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, props }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // tracking must never break the page
  }
}
