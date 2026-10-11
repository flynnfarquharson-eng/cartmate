import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SOURCE_COOKIE = "pd_src";
const SOURCE_PARAMS = ["ref", "utm_source", "utm_medium", "utm_campaign"] as const;

/**
 * Remember where a visitor came from (e.g. ?ref=instagram) until they sign up.
 * First touch wins, so a later visit doesn't overwrite the original source.
 */
function rememberSource(request: NextRequest, response: NextResponse) {
  if (request.cookies.has(SOURCE_COOKIE)) return;
  const params = request.nextUrl.searchParams;
  const source: Record<string, string> = {};
  for (const key of SOURCE_PARAMS) {
    const value = params.get(key);
    if (value) source[key] = value.slice(0, 100);
  }
  if (!Object.keys(source).length) return;
  source.landing_path = request.nextUrl.pathname;
  response.cookies.set(SOURCE_COOKIE, JSON.stringify(source), {
    maxAge: 30 * 24 * 3600,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

// Pages that need you to be logged in.
const PROTECTED = ["/feed", "/search", "/discover", "/welcome", "/podcast", "/settings", "/tips", "/episode", "/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Refreshes the login session if it has expired.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = !!data?.claims;
  const path = request.nextUrl.pathname;

  if (!loggedIn) rememberSource(request, response);

  if (!loggedIn && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (loggedIn && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on pages, but not on static files, images or API routes.
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
