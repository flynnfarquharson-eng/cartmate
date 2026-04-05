"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";

export default function JoinHouse() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [memberName, setMemberName] = useState("");
  const [email, setEmail] = useState("");
  const [houseName, setHouseName] = useState("");
  const [houseId, setHouseId] = useState("");
  const [step, setStep] = useState<"code" | "name">("code");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/houses/lookup?code=${code.trim().toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setHouseName(data.house.name);
      setHouseId(data.house.id);
      setStep("name");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "House not found");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!memberName.trim() || !email.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          houseId,
          name: memberName.trim(),
          email: email.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem("cartmate_member_id", data.member.id);
      localStorage.setItem("cartmate_house_id", houseId);
      router.push("/cart");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-12">
      <button
        onClick={() => (step === "name" ? setStep("code") : router.back())}
        className="text-gray-500 text-sm mb-6 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Join a House</h1>

      {step === "code" ? (
        <form onSubmit={handleLookup}>
          <Card className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invite Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm tracking-widest text-center font-mono text-lg focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading || code.length < 6}>
              {loading ? "Looking up..." : "Find House"}
            </Button>
          </Card>
        </form>
      ) : (
        <form onSubmit={handleJoin}>
          <Card className="space-y-4">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-sm text-green-800">
                Joining <span className="font-semibold">{houseName}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. alex@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading || !memberName || !email}>
              {loading ? "Joining..." : "Join House"}
            </Button>
          </Card>
        </form>
      )}
    </div>
  );
}
