import { NextResponse } from "next/server";

let sessionCookies: string | null = null;
let cookieTimestamp = 0;
const COOKIE_TTL = 1000 * 60 * 30; // 30 minutes

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json({ products: [] });
  }

  try {
    const cookies = await getSessionCookies();

    const res = await fetch(
      "https://www.woolworths.com.au/apis/ui/Search/products",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Origin: "https://www.woolworths.com.au",
          Referer: `https://www.woolworths.com.au/shop/search/products?searchTerm=${encodeURIComponent(query)}`,
          Cookie: cookies,
        },
        body: JSON.stringify({
          SearchTerm: query,
          PageSize: 8,
          PageNumber: 1,
          SortType: "TraderRelevance",
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ products: [] });
    }

    const data = await res.json();

    interface WoolworthsProduct {
      Name: string;
      Price: number;
      SmallImageFile: string;
      PackageSize: string;
      IsInStock: boolean;
    }

    interface WoolworthsProductGroup {
      Products: WoolworthsProduct[];
    }

    const products = (data.Products || [])
      .filter(
        (p: WoolworthsProductGroup) =>
          p.Products && Array.isArray(p.Products) && p.Products.length > 0
      )
      .map((p: WoolworthsProductGroup) => {
        const product = p.Products[0];
        return {
          name: product.Name,
          price: product.Price,
          image: product.SmallImageFile,
          packageSize: product.PackageSize,
        };
      })
      .slice(0, 6);

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ products: [] });
  }
}
