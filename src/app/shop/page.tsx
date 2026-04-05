"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMemberId, getHouseId, formatPrice } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categories";
import Card from "@/components/Card";

interface Product {
  name: string;
  price: number;
  image?: string;
  packageSize?: string;
}

export default function ShopPage() {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [cartCount, setCartCount] = useState(0);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mId = getMemberId();
    const hId = getHouseId();
    if (!mId || !hId) {
      router.replace("/");
      return;
    }
    setMemberId(mId);

    // Get current open order
    supabase
      .from("orders")
      .select("id")
      .eq("house_id", hId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setOrderId(data.id);
      });

    // Get current cart count
    supabase
      .from("orders")
      .select("id")
      .eq("house_id", hId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(async ({ data }) => {
        if (data) {
          const { count } = await supabase
            .from("items")
            .select("*", { count: "exact", head: true })
            .eq("order_id", data.id);
          setCartCount(count || 0);
        }
      });
  }, [router]);

  async function searchProducts(query: string) {
    if (query.length < 2) {
      setProducts([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/products/search?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      setProducts([]);
    }
    setLoading(false);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setActiveCategory(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchProducts(value), 400);
  }

  function handleCategoryClick(category: (typeof CATEGORIES)[0]) {
    setActiveCategory(category.id);
    setSearchQuery("");
    setLoading(true);

    fetch(`/api/products/search?q=${encodeURIComponent(category.searchTerm)}`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setLoading(false);
      });
  }

  async function addToCart(product: Product) {
    if (!orderId || !memberId) return;

    const itemName = product.packageSize
      ? `${product.name} ${product.packageSize}`
      : product.name;

    await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        memberId,
        name: itemName,
        price: product.price,
      }),
    });

    setAddedItems((prev) => new Set(prev).add(product.name));
    setCartCount((c) => c + 1);

    // Brief flash then reset
    setTimeout(() => {
      setAddedItems((prev) => {
        const next = new Set(prev);
        next.delete(product.name);
        return next;
      });
    }, 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/cart")}
            className="p-1 text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1 relative">
            <svg
              className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setProducts([]);
                  setActiveCategory(null);
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Categories */}
      {!searchQuery && !activeCategory && (
        <div className="px-4 pt-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Shop by category</h2>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col items-center gap-2 active:bg-gray-50 transition-colors"
              >
                <span className="text-3xl">{cat.emoji}</span>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active category header */}
      {activeCategory && (
        <div className="px-4 pt-4 flex items-center gap-2">
          <button
            onClick={() => {
              setActiveCategory(null);
              setProducts([]);
            }}
            className="text-gray-500"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-gray-900">
            {CATEGORIES.find((c) => c.id === activeCategory)?.emoji}{" "}
            {CATEGORIES.find((c) => c.id === activeCategory)?.name}
          </h2>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Product Grid */}
      {!loading && products.length > 0 && (
        <div className="px-4 pt-4">
          <div className="grid grid-cols-2 gap-3">
            {products.map((product, i) => {
              const isAdded = addedItems.has(product.name);
              return (
                <Card key={`${product.name}-${i}`} className="p-0 overflow-hidden">
                  <div className="p-3">
                    {/* Product Image */}
                    <div className="bg-gray-50 rounded-xl p-2 mb-3 flex items-center justify-center h-32">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-4xl text-gray-300">📦</div>
                      )}
                    </div>

                    {/* Price */}
                    <p className="text-lg font-bold text-gray-900">
                      {formatPrice(product.price)}
                    </p>

                    {/* Product Name */}
                    <p className="text-sm text-gray-700 leading-tight mt-1 line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </p>

                    {/* Pack Size */}
                    {product.packageSize && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {product.packageSize}
                      </p>
                    )}

                    {/* Add Button */}
                    <button
                      onClick={() => addToCart(product)}
                      disabled={isAdded}
                      className={`w-full mt-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                        isAdded
                          ? "bg-green-100 text-green-700"
                          : "bg-primary text-white active:bg-primary-dark"
                      }`}
                    >
                      {isAdded ? "✓ Added" : "Add to cart"}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && (searchQuery || activeCategory) && products.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No products found</p>
        </div>
      )}

      {/* Cart FAB */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => router.push("/cart")}
            className="w-full bg-primary text-white rounded-xl py-3 px-4 font-semibold text-sm flex items-center justify-center gap-2 active:bg-primary-dark"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
              />
            </svg>
            View Cart
            {cartCount > 0 && (
              <span className="bg-white text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
