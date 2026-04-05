"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMemberId, getHouseId } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categories";
import TabBar from "@/components/TabBar";

interface Product {
  name: string;
  price: number;
  image?: string;
  packageSize?: string;
  category?: string;
}

export default function ShopPage() {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<Record<string, number>>({});
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
          setOrderId(data.id);
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
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
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

    fetch(`/api/products/search?q=${encodeURIComponent(category.searchTerm)}&category=${encodeURIComponent(category.localCategory)}`)
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

    const key = product.name;
    setAddedItems((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    setCartCount((c) => c + 1);

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
  }

  const activeCat = CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="bg-primary sticky top-0 z-10">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-white text-lg font-bold">Shop</h1>
          </div>
          {/* Search bar */}
          <div className="relative">
            <svg
              className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-white rounded-lg pl-10 pr-10 py-2.5 text-sm"
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
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category pills - horizontal scroll */}
      {!searchQuery && !activeCategory && (
        <>
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-base font-bold text-gray-900">Categories</h2>
          </div>
          <div className="grid grid-cols-4 gap-2 px-4 pb-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className="flex flex-col items-center gap-1.5 py-3 px-1 bg-gray-50 rounded-xl active:bg-gray-100 transition-colors"
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-[11px] font-medium text-gray-700 text-center leading-tight">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Category header with back */}
      {activeCategory && (
        <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100">
          <button
            onClick={() => { setActiveCategory(null); setProducts([]); }}
            className="text-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg mr-1">{activeCat?.emoji}</span>
          <h2 className="text-base font-bold text-gray-900">{activeCat?.name}</h2>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Product Grid */}
      {!loading && products.length > 0 && (
        <div className="px-3 pt-3 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {products.map((product, i) => {
              const qty = addedItems[product.name] || 0;
              return (
                <div
                  key={`${product.name}-${i}`}
                  className="bg-white border border-gray-100 rounded-xl overflow-hidden"
                >
                  {/* Product Image */}
                  <div className="bg-gray-50 p-3 flex items-center justify-center h-36 relative">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-white rounded-lg flex items-center justify-center border border-gray-100">
                        <div className="text-center px-3">
                          <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-1">
                            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <p className="text-[10px] text-gray-400 leading-tight line-clamp-2">{product.name}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    {/* Price */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-gray-900">
                        ${Math.floor(product.price ?? 0)}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        .{((product.price ?? 0) % 1).toFixed(2).slice(2)}
                      </span>
                    </div>

                    {/* Name */}
                    <p className="text-xs text-gray-600 leading-tight mt-1 line-clamp-2 min-h-[2rem]">
                      {product.name}
                    </p>

                    {/* Pack Size */}
                    {product.packageSize && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {product.packageSize}
                      </p>
                    )}

                    {/* Add / Quantity stepper */}
                    <div className="mt-2">
                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(product)}
                          className="w-full bg-primary text-white rounded-lg py-2 text-sm font-semibold active:bg-primary-dark transition-colors"
                        >
                          Add
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-primary-light rounded-lg">
                          <button
                            onClick={() => {
                              setAddedItems((prev) => {
                                const next = { ...prev };
                                if (next[product.name] <= 1) delete next[product.name];
                                else next[product.name]--;
                                return next;
                              });
                              setCartCount((c) => Math.max(0, c - 1));
                              // Note: doesn't remove from DB in this simplified version
                            }}
                            className="w-10 h-9 flex items-center justify-center text-primary font-bold text-lg"
                          >
                            -
                          </button>
                          <span className="text-sm font-bold text-primary">{qty}</span>
                          <button
                            onClick={() => addToCart(product)}
                            className="w-10 h-9 flex items-center justify-center text-primary font-bold text-lg"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && (searchQuery || activeCategory) && products.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-500 text-sm">No products found</p>
          <p className="text-gray-400 text-xs mt-1">Try a different search term</p>
        </div>
      )}

      <TabBar cartCount={cartCount} />
    </div>
  );
}
