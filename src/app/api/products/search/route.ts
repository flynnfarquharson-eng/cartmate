import { NextResponse } from "next/server";
import { GROCERY_PRODUCTS } from "@/lib/groceries";

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

function searchLocalProducts(query: string, category?: string) {
  // If category is provided, filter by category first
  if (category) {
    const cats = category.split(",").map((c) => c.trim().toLowerCase());
    const filtered = GROCERY_PRODUCTS.filter((p) =>
      cats.some((c) => p.category.toLowerCase() === c)
    );
    return filtered.slice(0, 12).map((p) => ({
      name: p.name,
      price: p.price,
      image: null,
      packageSize: null,
      category: p.category,
    }));
  }

  // Otherwise search by matching any word in the query
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  const scored = GROCERY_PRODUCTS.map((p) => {
    const name = p.name.toLowerCase();
    const cat = p.category.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (name.includes(word)) score += 2;
      if (cat.includes(word)) score += 1;
    }
    return { product: p, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return scored.map((s) => ({
    name: s.product.name,
    price: s.product.price,
    image: null,
    packageSize: null,
    category: s.product.category,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const category = searchParams.get("category");

  if ((!query || query.length < 2) && !category) {
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
          Referer: `https://www.woolworths.com.au/shop/search/products?searchTerm=${encodeURIComponent(query || "")}`,
          Cookie: cookies,
        },
        body: JSON.stringify({
          SearchTerm: query || category,
          PageSize: 12,
          PageNumber: 1,
          SortType: "TraderRelevance",
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({
        products: searchLocalProducts(query || "", category || undefined),
      });
    }

    const data = await res.json();

    interface WoolworthsProduct {
      Name: string;
      Price: number;
      SmallImageFile: string;
      PackageSize: string;
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
      .slice(0, 12);

    if (products.length === 0) {
      return NextResponse.json({
        products: searchLocalProducts(query || "", category || undefined),
      });
    }

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({
      products: searchLocalProducts(query || "", category || undefined),
    });
  }
}
