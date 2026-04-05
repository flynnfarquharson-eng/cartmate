"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMemberId, getHouseId, clearSession } from "@/lib/utils";
import type { Member } from "@/lib/database.types";
import Avatar from "@/components/Avatar";
import TabBar from "@/components/TabBar";

export default function HousePage() {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [houseName, setHouseName] = useState("");
  const [houseAddress, setHouseAddress] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const mId = getMemberId();
    const hId = getHouseId();
    if (!mId || !hId) {
      router.replace("/");
      return;
    }
    setMemberId(mId);

    supabase.from("houses").select("*").eq("id", hId).single().then(({ data }) => {
      if (data) {
        setHouseName(data.name);
        setHouseAddress(data.address);
        setInviteCode(data.invite_code);
        setStoreName(data.store_name || "");
      }
    });

    supabase.from("members").select("*").eq("house_id", hId).then(({ data }) => {
      if (data) setMembers(data);
    });
  }, [router]);

  function shareInviteLink() {
    const url = `${window.location.origin}/join/${inviteCode}`;
    if (navigator.share) {
      navigator.share({ title: `Join ${houseName} on CartMate`, text: `Join our shared grocery order!`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  function handleLeave() {
    clearSession();
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-primary px-4 pt-4 pb-6">
        <h1 className="text-white text-lg font-bold">House</h1>
      </div>

      {/* House card */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-lg font-bold text-gray-900">{houseName}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{houseAddress}</p>
          {storeName && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                <span className="text-xs font-bold text-green-700">W</span>
              </div>
              <span className="text-sm text-gray-700">{storeName}</span>
            </div>
          )}
          <button
            onClick={() => router.push("/select-store")}
            className="mt-2 text-sm text-primary font-medium"
          >
            Change store
          </button>
        </div>
      </div>

      {/* Members */}
      <div className="px-4 pt-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Members ({members.length})</h3>
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3">
              <Avatar name={m.name} color={m.avatar_color} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {m.name}
                  {m.id === memberId && <span className="text-xs text-gray-400 font-normal ml-1">(you)</span>}
                </p>
                <p className="text-xs text-gray-500">{m.email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1">Invite Housemates</h3>
          <p className="text-xs text-gray-500 mb-3">Share this code or link so others can join</p>
          <div className="bg-gray-50 rounded-lg p-3 text-center mb-3">
            <span className="font-mono text-2xl font-bold tracking-widest text-gray-900">{inviteCode}</span>
          </div>
          <button
            onClick={shareInviteLink}
            className="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-semibold"
          >
            {copiedLink ? "Link Copied!" : "Share Invite Link"}
          </button>
        </div>
      </div>

      {/* Leave house */}
      <div className="px-4 pt-4">
        <button
          onClick={handleLeave}
          className="w-full bg-white rounded-xl border border-gray-100 p-3 text-sm text-red-500 font-medium text-center"
        >
          Leave House
        </button>
      </div>

      <TabBar />
    </div>
  );
}
