"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";

export default function PasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === "housemate") {
      localStorage.setItem("cartmate_auth", "true");
      router.replace("/");
    } else {
      setError("Wrong password");
      setPassword("");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">CartMate</h1>
        <p className="text-gray-500 mt-1 text-sm">Enter password to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <Card className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="Password"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-center focus:border-primary focus:ring-1 focus:ring-primary"
            autoFocus
          />
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <Button type="submit" disabled={!password}>
            Enter
          </Button>
        </Card>
      </form>
    </div>
  );
}
