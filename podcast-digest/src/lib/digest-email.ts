import "server-only";
import { formatTimestamp } from "@/lib/format";
import type { Quote } from "@/lib/types";

// Builds the digest email as plain HTML with inline styles and tables, because
// email apps (Gmail, Outlook, Apple Mail) ignore most modern CSS.

export type DigestEpisode = {
  id: string;
  title: string;
  podcastTitle: string;
  imageUrl: string | null;
  episodeUrl: string | null;
  overview: string;
  tips: { text: string; timestampSeconds: number | null }[];
  quote: Quote | null;
};

export type DigestLinks = {
  app: string;
  settings: string;
  unsubscribe: string;
  creators: string;
  privacy: string;
};

const MAX_TIPS = 2;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** First few sentences, so the email stays a quick read and links back for the rest. */
function shorten(text: string, maxChars = 420): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastStop = cut.lastIndexOf(". ");
  return (lastStop > 150 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + "…");
}

export function digestSubject(episodes: DigestEpisode[]): string {
  const shows = [...new Set(episodes.map((e) => e.podcastTitle))];
  if (shows.length === 1) return `${shows[0]}: ${episodes.length === 1 ? episodes[0].title : `${episodes.length} new episodes`}`;
  if (shows.length === 2) return `This week: ${shows[0]} and ${shows[1]}`;
  return `This week: ${shows[0]}, ${shows[1]} + ${shows.length - 2} more`;
}

export function renderDigest({
  episodes,
  links,
  frequency,
  senderLine,
}: {
  episodes: DigestEpisode[];
  links: DigestLinks;
  frequency: "weekly" | "daily";
  senderLine: string;
}): { html: string; text: string } {
  const intro =
    frequency === "weekly"
      ? `${episodes.length} new ${episodes.length === 1 ? "episode" : "episodes"} from your shows this week.`
      : `${episodes.length} new ${episodes.length === 1 ? "episode" : "episodes"} from your shows.`;

  const blocks = episodes.map((e) => {
    const page = `${links.app}/episode/${e.id}`;
    const tips = e.tips.slice(0, MAX_TIPS);
    const tipsHtml = tips.length
      ? `<p style="margin:14px 0 6px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6d28d9">Top tips</p>
         <ul style="margin:0;padding-left:18px;color:#1c1c1e">${tips
           .map(
             (t) =>
               `<li style="margin:0 0 6px;font-size:15px;line-height:1.45">${esc(t.text)}${
                 t.timestampSeconds != null
                   ? ` <a href="${page}?t=${t.timestampSeconds}" style="color:#6d28d9;text-decoration:none;font-size:13px;white-space:nowrap">▶ ${formatTimestamp(t.timestampSeconds)}</a>`
                   : ""
               }</li>`,
           )
           .join("")}</ul>`
      : "";
    const quoteHtml = e.quote
      ? `<p style="margin:14px 0 0;padding-left:12px;border-left:3px solid #6d28d9;font-style:italic;font-size:15px;line-height:1.45;color:#3a3a3c">“${esc(e.quote.quote)}”${
          e.quote.speaker ? `<br><span style="font-style:normal;font-size:13px;color:#6b6b70">${esc(e.quote.speaker)}</span>` : ""
        }</p>`
      : "";
    const art = e.imageUrl
      ? `<img src="${esc(e.imageUrl)}" width="56" height="56" alt="" style="display:block;border-radius:10px;border:0">`
      : "";
    return `
<tr><td style="padding:24px 0;border-top:1px solid #e6e6e3">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
    <td width="68" valign="top">${art}</td>
    <td valign="top">
      <p style="margin:0;font-size:13px;color:#6b6b70">${esc(e.podcastTitle)}</p>
      <p style="margin:2px 0 0;font-size:17px;font-weight:600;line-height:1.3"><a href="${page}" style="color:#1c1c1e;text-decoration:none">${esc(e.title)}</a></p>
    </td>
  </tr></table>
  <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#1c1c1e">${esc(shorten(e.overview))}</p>
  ${tipsHtml}
  ${quoteHtml}
  <p style="margin:16px 0 0;font-size:14px">
    <a href="${page}" style="color:#6d28d9;font-weight:600;text-decoration:none">Read the full summary →</a>
    ${e.episodeUrl ? `&nbsp;&nbsp;<a href="${esc(e.episodeUrl)}" style="color:#6b6b70;text-decoration:none">Listen to the full episode</a>` : ""}
  </p>
</td></tr>`;
  });

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f7f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f7f7f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:16px">
<tr><td style="padding:28px 24px 8px">
  <p style="margin:0;font-size:13px;font-weight:600;color:#6d28d9">Podcast Digest</p>
  <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#1c1c1e">${esc(intro)}</p>
</td></tr>
<tr><td style="padding:0 24px"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${blocks.join("")}</table></td></tr>
<tr><td style="padding:20px 24px 28px;border-top:1px solid #e6e6e3;font-size:12px;line-height:1.6;color:#6b6b70">
  Summaries are written by AI from each show's public episodes. All credit goes to the creators, so please listen to the full episodes.<br><br>
  You're getting this because you signed up for Podcast Digest.
  <a href="${links.settings}" style="color:#6b6b70">Change shows or frequency</a> ·
  <a href="${links.unsubscribe}" style="color:#6b6b70">Unsubscribe</a> ·
  <a href="${links.privacy}" style="color:#6b6b70">Privacy</a><br>
  Podcast creator? <a href="${links.creators}" style="color:#6b6b70">Ask us to stop summarising your show</a>.<br><br>
  ${esc(senderLine)}
</td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    "PODCAST DIGEST",
    intro,
    "",
    ...episodes.flatMap((e) => [
      "----------------------------------------",
      `${e.podcastTitle}: ${e.title}`,
      "",
      shorten(e.overview),
      ...(e.tips.length ? ["", "Top tips:", ...e.tips.slice(0, MAX_TIPS).map((t) => `- ${t.text}`)] : []),
      ...(e.quote ? ["", `"${e.quote.quote}"${e.quote.speaker ? ` (${e.quote.speaker})` : ""}`] : []),
      "",
      `Full summary: ${links.app}/episode/${e.id}`,
      ...(e.episodeUrl ? [`Listen: ${e.episodeUrl}`] : []),
      "",
    ]),
    "----------------------------------------",
    "Summaries are written by AI from each show's public episodes. All credit goes to the creators.",
    `Change shows or frequency: ${links.settings}`,
    `Unsubscribe: ${links.unsubscribe}`,
    `Privacy: ${links.privacy}`,
    `Podcast creator? ${links.creators}`,
    senderLine,
  ].join("\n");

  return { html, text };
}
