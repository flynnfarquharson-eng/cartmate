"use client";

import { useState, useRef, useEffect } from "react";

interface Suggestion {
  display_name: string;
  place_id: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing an address...",
}: {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(val: string) {
    onChange(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (val.length >= 3) {
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&addressdetails=1&limit=5&countrycodes=au`,
            { headers: { "User-Agent": "CartMate/1.0" } }
          );
          const data = await res.json();
          setSuggestions(data || []);
          setShowSuggestions((data || []).length > 0);
        } catch {
          setShowSuggestions(false);
        }
      }, 400);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function selectSuggestion(suggestion: Suggestion) {
    onChange(suggestion.display_name);
    setShowSuggestions(false);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
      />
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              onClick={() => selectSuggestion(s)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
            >
              <p className="text-gray-900 leading-tight">{s.display_name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
