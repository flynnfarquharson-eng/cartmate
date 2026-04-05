"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";

export default function JoinByLink() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const [houseName, setHouseName] = useState("");
  const [houseId, setHouseId] = useState("");
  const [memberName, setMemberName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function lookup() {
      try {
        const res = await fetch(`/api/houses/lookup?code=${code.toUpperCase()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setHouseName(data.house.name);
        setHouseId(data.house.id);
      } catch {
        setError("Invalid invite link. Check with your housemate for the correct link.");
      } finally {
        setLoading(false);
      }
    }
    lookup();
  }, [code]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!memberName.trim() || !email.trim()) return;

    setSubmitting(true);
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
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error && !houseId) {
    return (
      <div className="min-h-screen px-6 py-12 flex flex-col items-center justify-center">
        <Card className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="secondary" onClick={() => router.push("/")}>
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Join House</h1>

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
          <Button type="submit" disabled={submitting || !memberName || !email}>
            {submitting ? "Joining..." : "Join House"}
          </Button>
        </Card>
      </form>
    </div>
  );
}
