"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/Button";
import Card from "@/components/Card";
import { getHouseId, getMemberId } from "@/lib/utils";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const houseId = getHouseId();
    const memberId = getMemberId();
    if (houseId && memberId) {
      router.replace("/cart");
    }
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">CartMate</h1>
        <p className="text-gray-500 mt-2">
          Shared grocery orders for your house
        </p>
      </div>

      <div className="w-full space-y-3">
        <Card>
          <h2 className="font-semibold text-gray-900 mb-1">Create a House</h2>
          <p className="text-sm text-gray-500 mb-4">
            Start a new house and invite your housemates
          </p>
          <Link href="/create">
            <Button>Create House</Button>
          </Link>
        </Card>

        <Card>
          <h2 className="font-semibold text-gray-900 mb-1">Join a House</h2>
          <p className="text-sm text-gray-500 mb-4">
            Enter an invite code to join an existing house
          </p>
          <Link href="/join">
            <Button variant="secondary">Join House</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
