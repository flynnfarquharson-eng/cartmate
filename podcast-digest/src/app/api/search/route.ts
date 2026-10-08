import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { resolveShowLink, searchApple, type AppleShow } from "@/lib/apple";
import type { RecSource, ShowSummary } from "@/lib/types";

function toSummary(s: AppleShow): ShowSummary {
  return {
    itunesId: s.itunesId,
    title: s.title,
    author: s.author,
    imageUrl: s.imageUrl,
    latestEpisodeAt: s.latestEpisodeAt,
  };
}

/** Search by name, or paste an Apple Podcasts / Spotify link to find that exact show. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    if (/^https?:\/\//i.test(q)) {
      const show = await resolveShowLink(q);
      if (!show) {
        return NextResponse.json(
          { error: "Couldn't find a podcast at that link. Try an Apple Podcasts or Spotify show link, or search by name." },
          { status: 404 },
        );
      }
      return NextResponse.json({ results: [toSummary(show)], source: "link" satisfies RecSource });
    }
    const results = await searchApple(q);
    return NextResponse.json({ results: results.map(toSummary), source: "search" satisfies RecSource });
  } catch (err) {
    console.error("[search]", err);
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 502 });
  }
}
