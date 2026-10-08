import "server-only";
import { requireEnv } from "@/lib/env";

// Sends through Resend's REST API. Docs: https://resend.com/docs/api-reference/emails/send-email
// EMAIL_FROM must be on a domain verified in Resend, e.g. "Podcast Digest <digest@yourdomain.com>".
// Before a domain is verified, Resend only delivers "onboarding@resend.dev" mail to your own address.

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export async function sendEmail(email: OutgoingEmail): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Podcast Digest <onboarding@resend.dev>",
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !data.id) throw new Error(`Resend failed: HTTP ${res.status} ${data.message ?? ""}`.trim());
  return { id: data.id };
}

/** Public address of the app, used in every link inside emails. */
export function appUrl(): string {
  return (process.env.APP_URL || "https://podcast-digest-six.vercel.app").replace(/\/$/, "");
}
