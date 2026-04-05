"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getHouseId } from "@/lib/utils";
import Card from "@/components/Card";
import Button from "@/components/Button";

interface Store {
  id: string;
  chain: string;
  storeNo: string;
  name: string;
  address: string;
  suburb: string;
  distance: number;
  isOpen: boolean;
  todayHours: string;
}

export default function SelectStore() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [saving, setSaving] = useState(false);
  const [address, setAddress] = useState("");

  useEffect(() => {
    async function loadStores() {
      const houseId = getHouseId();
      if (!houseId) {
        router.replace("/");
        return;
      }

      // Get house address
      const { data: house } = await supabase
        .from("houses")
        .select("address")
        .eq("id", houseId)
        .single();

      if (!house) {
        router.replace("/");
        return;
      }

      setAddress(house.address);

      // Fetch nearby stores based on address
      const res = await fetch(
        `/api/stores?address=${encodeURIComponent(house.address)}`
      );
      const data = await res.json();
      setStores(data.stores || []);
      setLoading(false);
    }

    loadStores();
  }, [router]);

  async function handleSave() {
    if (!selectedStore) return;
    setSaving(true);

    const houseId = getHouseId();
    await fetch("/api/houses/update-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        houseId,
        storeChain: selectedStore.chain,
        storeName: selectedStore.name,
        storeNo: selectedStore.storeNo,
      }),
    });

    router.push("/cart");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-gray-500">Finding nearby stores...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary px-4 py-6 text-white">
        <h1 className="text-2xl font-bold">Select Your Store</h1>
        <p className="text-green-100 text-sm mt-1">
          Showing stores near {address}
        </p>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {stores.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-4">
              No stores found nearby. Try a different address.
            </p>
          </Card>
        ) : (
          stores.map((store) => (
            <button
              key={store.id}
              onClick={() => setSelectedStore(store)}
              className="w-full text-left"
            >
              <Card
                className={`transition-all ${
                  selectedStore?.id === store.id
                    ? "ring-2 ring-primary border-primary"
                    : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-green-700">W</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {store.name}
                      </h3>
                      {store.isOpen ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">
                          Open
                        </span>
                      ) : (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full shrink-0">
                          Closed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {store.address}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">
                        {store.distance} km away
                      </span>
                      <span className="text-xs text-gray-400">
                        {store.todayHours}
                      </span>
                    </div>
                  </div>
                  {selectedStore?.id === store.id && (
                    <svg
                      className="w-6 h-6 text-primary shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  )}
                </div>
              </Card>
            </button>
          ))
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-lg mx-auto">
          <Button onClick={handleSave} disabled={!selectedStore || saving}>
            {saving
              ? "Saving..."
              : selectedStore
              ? `Shop at ${selectedStore.name}`
              : "Select a store"}
          </Button>
        </div>
      </div>
    </div>
  );
}
