import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { searchPodcasts } from "@/lib/podcast-index";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await searchPodcasts(q);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[search]", err);
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 502 });
  }
}
