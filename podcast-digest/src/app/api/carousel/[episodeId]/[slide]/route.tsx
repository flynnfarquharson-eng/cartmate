import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/env";
import { getCarouselData } from "@/lib/carousel";
import { formatTimestamp } from "@/lib/format";

const W = 1080;
const H = 1350; // Instagram portrait (4:5)
const PURPLE = "#6d28d9";
// The built-in font has no bold, so load Inter (regular + extra bold) once per server instance.
const FONT_URL = (weight: number) => `https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-${weight}-normal.ttf`;
let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 800; style: "normal" }[]> | null = null;
function loadFonts() {
  fontsPromise ??= Promise.all(
    ([400, 800] as const).map(async (weight) => {
      const res = await fetch(FONT_URL(weight));
      if (!res.ok) throw new Error(`Font ${weight} failed: ${res.status}`);
      return { name: "Inter", data: await res.arrayBuffer(), weight, style: "normal" as const };
    }),
  ).catch((err) => {
    fontsPromise = null; // try again next time
    throw err;
  });
  return fontsPromise;
}

const SITE = (process.env.APP_URL || "https://podcast-digest-six.vercel.app").replace(/^https?:\/\//, "");

function Frame({ children, footer }: { children: React.ReactNode; footer: string }) {
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#f7f7f5", padding: 90, fontFamily: "Inter" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, color: PURPLE, fontSize: 30, fontWeight: 800 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: PURPLE, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff" }} />
        </div>
        Podie
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", fontSize: 26, color: "#6b6b70" }}>{footer}</div>
    </div>
  );
}

/** One carousel slide as a PNG. Slide 0 is the cover, then one per tip, then a closing slide. Admin only. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/carousel/[episodeId]/[slide]">) {
  const user = await getUser();
  if (!isAdminEmail(user?.email)) return new Response("Unauthorized", { status: 401 });

  const { episodeId, slide: slideParam } = await ctx.params;
  const data = await getCarouselData(episodeId);
  if (!data) return new Response("Not found", { status: 404 });

  const slide = Number(slideParam);
  const total = data.tips.length + 2;
  if (!Number.isInteger(slide) || slide < 0 || slide >= total) return new Response("Not found", { status: 404 });
  const credit = `From ${data.podcastTitle} · Listen to the full episode`;

  let content: React.ReactNode;
  if (slide === 0) {
    content = (
      <Frame footer={`Swipe →   ·   ${credit}`}>
        {data.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not a web page
          <img src={data.imageUrl} width={220} height={220} style={{ borderRadius: 32, marginBottom: 50 }} alt="" />
        )}
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1.05, color: "#1c1c1e" }}>
          {`${data.tips.length} takeaways from ${data.podcastTitle}`}
        </div>
        <div style={{ display: "flex", fontSize: 40, marginTop: 36, color: "#3a3a3c", lineHeight: 1.3 }}>{data.episodeTitle}</div>
      </Frame>
    );
  } else if (slide <= data.tips.length) {
    const tip = data.tips[slide - 1];
    content = (
      <Frame footer={credit}>
        <div style={{ display: "flex", fontSize: 150, fontWeight: 800, color: PURPLE, lineHeight: 1 }}>{String(slide)}</div>
        <div style={{ display: "flex", fontSize: tip.text.length > 160 ? 52 : 62, fontWeight: 800, lineHeight: 1.25, color: "#1c1c1e", marginTop: 30 }}>
          {tip.text}
        </div>
        {tip.timestampSeconds != null && (
          <div style={{ display: "flex", fontSize: 32, marginTop: 40, color: PURPLE }}>{`Listen at ${formatTimestamp(tip.timestampSeconds)}`}</div>
        )}
      </Frame>
    );
  } else {
    content = (
      <Frame footer={credit}>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.1, color: "#1c1c1e" }}>
          Get the best ideas from your favourite podcasts. Every Sunday.
        </div>
        <div style={{ display: "flex", fontSize: 44, marginTop: 40, color: "#3a3a3c" }}>A free 3-minute email digest.</div>
        <div style={{ display: "flex", marginTop: 60, alignSelf: "flex-start", background: PURPLE, color: "#fff", fontSize: 44, fontWeight: 800, padding: "26px 44px", borderRadius: 999 }}>
          Link in bio
        </div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 30, color: "#6b6b70" }}>{SITE}</div>
      </Frame>
    );
  }

  // If the font can't load, still return a slide in the built-in font.
  const fonts = await loadFonts().catch(() => undefined);
  return new ImageResponse(content as React.ReactElement, {
    width: W,
    height: H,
    fonts,
    headers: { "Content-Disposition": `inline; filename="slide-${slide + 1}.png"` },
  });
}
