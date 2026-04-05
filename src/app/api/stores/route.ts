import { NextResponse } from "next/server";

interface WoolworthsStore {
  StoreNo: string;
  Name: string;
  AddressLine1: string;
  Suburb: string;
  State: string;
  Postcode: string;
  Distance: string;
  IsOpen: boolean;
  TradingHours: { Day: string; OpenHour: string }[];
}

let sessionCookies: string | null = null;
let cookieTimestamp = 0;
const COOKIE_TTL = 1000 * 60 * 30;

async function getSessionCookies(): Promise<string> {
  if (sessionCookies && Date.now() - cookieTimestamp < COOKIE_TTL) {
    return sessionCookies;
  }
  const res = await fetch("https://www.woolworths.com.au", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  const cookies = res.headers.getSetCookie?.() || [];
  sessionCookies = cookies.map((c) => c.split(";")[0]).join("; ");
  cookieTimestamp = Date.now();
  return sessionCookies;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  // Use Nominatim (free, no API key needed) to geocode the address
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", Australia")}&format=json&limit=1`,
    {
      headers: {
        "User-Agent": "CartMate/1.0",
      },
    }
  );
  const data = await res.json();
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  let coords: { lat: number; lng: number } | null = null;

  if (lat && lng) {
    coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
  } else if (address) {
    coords = await geocodeAddress(address);
  }

  if (!coords) {
    return NextResponse.json({ error: "Could not determine location" }, { status: 400 });
  }

  try {
    const cookies = await getSessionCookies();

    // Fetch Woolworths stores
    const woolworthsRes = await fetch(
      `https://www.woolworths.com.au/apis/ui/StoreLocator/Stores?latitude=${coords.lat}&longitude=${coords.lng}&Max=5&Division=SUPERMARKETS`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Cookie: cookies,
        },
      }
    );

    const woolworthsData = await woolworthsRes.json();
    const woolworthsStores = (woolworthsData.Stores || woolworthsData || []).map(
      (s: WoolworthsStore) => ({
        id: `woolworths-${s.StoreNo}`,
        chain: "Woolworths",
        storeNo: s.StoreNo,
        name: s.Name,
        address: `${s.AddressLine1}, ${s.Suburb} ${s.State} ${s.Postcode}`,
        suburb: s.Suburb,
        distance: parseFloat(s.Distance),
        isOpen: s.IsOpen,
        todayHours: s.TradingHours?.[0]?.OpenHour || "Unknown",
        logo: "/woolworths-logo.svg",
      })
    );

    // We'd add Coles stores here when their API becomes available
    const allStores = [...woolworthsStores].sort(
      (a: { distance: number }, b: { distance: number }) => a.distance - b.distance
    );

    return NextResponse.json({ stores: allStores, coords });
  } catch {
    return NextResponse.json({ stores: [], coords });
  }
}
