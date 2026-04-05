"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMemberId, getHouseId, formatPrice, clearSession } from "@/lib/utils";
import type { Member, Order, Item, Payment } from "@/lib/database.types";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import TabBar from "@/components/TabBar";

const SERVICE_FEE = 4.99;

export default function CartPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <CartPage />
    </Suspense>
  );
}

function CartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [houseName, setHouseName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchData = useCallback(async (hId: string) => {
    const [houseRes, membersRes, orderRes] = await Promise.all([
      supabase.from("houses").select("*").eq("id", hId).single(),
      supabase.from("members").select("*").eq("house_id", hId),
      supabase
        .from("orders")
        .select("*")
        .eq("house_id", hId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

    if (houseRes.data) {
      setHouseName(houseRes.data.name);
      setStoreName(houseRes.data.store_name || "");
      setInviteCode(houseRes.data.invite_code);
    }
    if (membersRes.data) setMembers(membersRes.data);
    if (orderRes.data) {
      setOrder(orderRes.data);
      const [itemsRes, paymentsRes] = await Promise.all([
        supabase.from("items").select("*").eq("order_id", orderRes.data.id),
        supabase.from("payments").select("*").eq("order_id", orderRes.data.id),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const mId = getMemberId();
    const hId = getHouseId();
    if (!mId || !hId) {
      router.replace("/");
      return;
    }
    setMemberId(mId);
    fetchData(hId);

    if (searchParams.get("success") === "true") {
      setSuccessMsg("Payment successful! Thanks for paying your share.");
      setTimeout(() => setSuccessMsg(""), 5000);
    }
  }, [router, searchParams, fetchData]);

  useEffect(() => {
    if (!order?.id) return;

    const itemsChannel = supabase
      .channel("items-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `order_id=eq.${order.id}` }, () => {
        supabase.from("items").select("*").eq("order_id", order.id).then(({ data }) => { if (data) setItems(data); });
      })
      .subscribe();

    const paymentsChannel = supabase
      .channel("payments-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `order_id=eq.${order.id}` }, () => {
        supabase.from("payments").select("*").eq("order_id", order.id).then(({ data }) => { if (data) setPayments(data); });
      })
      .subscribe();

    const ordersChannel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` }, (payload) => {
        setOrder(payload.new as Order);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [order?.id]);

  async function deleteItem(itemId: string) {
    await fetch(`/api/items?id=${itemId}&memberId=${memberId}`, { method: "DELETE" });
  }

  async function handlePay() {
    if (!order || !memberId) return;
    setPayLoading(true);
    const myItems = items.filter((i) => i.member_id === memberId);
    const subtotal = myItems.reduce((sum, i) => sum + Number(i.price), 0);
    const feeShare = SERVICE_FEE / Math.max(membersWithItems.length, 1);
    const member = members.find((m) => m.id === memberId);

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, memberId, amount: subtotal + feeShare, memberEmail: member?.email }),
    });
    const data = await res.json();
    setPayLoading(false);
    if (data.url) window.location.href = data.url;
  }

  async function handlePlaceOrder() {
    if (!order) return;
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, status: "confirmed" }),
    });
    router.push(`/order/${order.id}`);
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const itemsByMember: Record<string, Item[]> = {};
  items.forEach((item) => {
    if (!itemsByMember[item.member_id]) itemsByMember[item.member_id] = [];
    itemsByMember[item.member_id].push(item);
  });

  const grandTotal = items.reduce((sum, i) => sum + Number(i.price), 0);
  const mySubtotal = items.filter((i) => i.member_id === memberId).reduce((sum, i) => sum + Number(i.price), 0);
  const myPayment = payments.find((p) => p.member_id === memberId && p.status === "paid");
  const membersWithItems = members.filter((m) => itemsByMember[m.id]?.length > 0);
  const isLocked = order?.status === "locked";
  const hasItems = items.length > 0;
  const feePerPerson = SERVICE_FEE / Math.max(membersWithItems.length, 1);
  const myTotal = mySubtotal + (mySubtotal > 0 ? feePerPerson : 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      {/* Header */}
      <div className="bg-primary px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-lg font-bold">{houseName}</h1>
            <p className="text-green-200 text-xs">
              {storeName ? `${storeName} · ` : ""}{members.length} member{members.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowInvite(!showInvite)} className="p-2 rounded-lg bg-white/10 text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
            <button onClick={() => { clearSession(); router.replace("/"); }} className="p-2 rounded-lg bg-white/10 text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Member avatars */}
        <div className="flex items-center gap-1.5 mt-3">
          {members.map((m) => (
            <div key={m.id} className="relative">
              <Avatar name={m.name} color={m.avatar_color} size="sm" />
              {itemsByMember[m.id]?.length > 0 && payments.some((p) => p.member_id === m.id && p.status === "paid") && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-primary" />
              )}
            </div>
          ))}
          <button onClick={() => setShowInvite(true)} className="w-8 h-8 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center text-white/60">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div className="mx-4 mt-4 bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Invite Code</p>
              <span className="font-mono text-xl font-bold tracking-widest text-gray-900">{inviteCode}</span>
            </div>
            <button onClick={() => setShowInvite(false)} className="text-gray-400 p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button onClick={shareInviteLink} className="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-semibold">
            {copiedLink ? "Link Copied!" : "Share Invite Link"}
          </button>
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">{successMsg}</div>
      )}

      {/* Empty state */}
      {!hasItems && !isLocked && (
        <div className="px-4 pt-16 text-center">
          <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Your cart is empty</h2>
          <p className="text-sm text-gray-500 mb-6">Start adding items and your housemates will see them in real-time</p>
          <Button onClick={() => router.push("/shop")}>Start Shopping</Button>
        </div>
      )}

      {/* Cart contents */}
      {hasItems && (
        <>
          {/* Items by member */}
          <div className="px-4 pt-4 space-y-3">
            {members.map((member) => {
              const memberItems = itemsByMember[member.id] || [];
              if (memberItems.length === 0) return null;
              const subtotal = memberItems.reduce((sum, i) => sum + Number(i.price), 0);
              const isPaid = payments.some((p) => p.member_id === member.id && p.status === "paid");
              const isMe = member.id === memberId;

              // Group duplicates
              const grouped: { item: Item; qty: number }[] = [];
              const seen: Record<string, number> = {};
              memberItems.forEach((item) => {
                const key = `${item.name}|${item.price}`;
                if (seen[key] !== undefined) grouped[seen[key]].qty++;
                else { seen[key] = grouped.length; grouped.push({ item, qty: 1 }); }
              });

              return (
                <div key={member.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {/* Member header */}
                  <div className="flex items-center gap-3 p-3 border-b border-gray-50">
                    <Avatar name={member.name} color={member.avatar_color} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {member.name}
                          {isMe && <span className="text-xs text-gray-400 font-normal ml-1">(you)</span>}
                        </span>
                        {isPaid ? <Badge variant="paid">Paid</Badge> : <Badge variant="pending">Pending</Badge>}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{formatPrice(subtotal)}</span>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-gray-50">
                    {grouped.map(({ item, qty }) => (
                      <div key={item.id} className="flex items-center px-3 py-2.5">
                        {qty > 1 && (
                          <span className="text-xs font-bold text-primary bg-primary-light w-6 h-6 rounded flex items-center justify-center mr-2 shrink-0">
                            {qty}
                          </span>
                        )}
                        <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{item.name}</span>
                        <span className="text-sm font-medium text-gray-900 ml-2 shrink-0">{formatPrice(Number(item.price) * qty)}</span>
                        {isMe && !isLocked && (
                          <button onClick={() => deleteItem(item.id)} className="ml-2 text-gray-300 hover:text-red-500 shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order summary */}
          <div className="px-4 pt-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Order Summary</h3>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal ({items.length} items)</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Service fee</span>
                <span>{formatPrice(SERVICE_FEE)}</span>
              </div>
              {membersWithItems.length > 1 && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Fee split {membersWithItems.length} ways</span>
                  <span>{formatPrice(feePerPerson)}/person</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between text-base font-bold text-gray-900">
                <span>Total</span>
                <span>{formatPrice(grandTotal + SERVICE_FEE)}</span>
              </div>
              {mySubtotal > 0 && (
                <div className="flex justify-between text-sm font-semibold text-primary">
                  <span>Your share</span>
                  <span>{formatPrice(myTotal)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment status */}
          {membersWithItems.length > 0 && (
            <div className="px-4 pt-3">
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <span>{payments.filter((p) => p.status === "paid").length}/{membersWithItems.length} members paid</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bottom action bar */}
      <div className="fixed bottom-[60px] left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
        <div className="max-w-lg mx-auto">
          {isLocked ? (
            <Button onClick={handlePlaceOrder}>Place Order</Button>
          ) : myPayment ? (
            <Button disabled>You&apos;ve paid {formatPrice(Number(myPayment.amount))}</Button>
          ) : mySubtotal > 0 ? (
            <Button onClick={handlePay} disabled={payLoading}>
              {payLoading ? "Redirecting..." : `Pay ${formatPrice(myTotal)}`}
            </Button>
          ) : hasItems ? (
            <Button onClick={() => router.push("/shop")}>Add Your Items</Button>
          ) : null}
        </div>
      </div>

      <TabBar cartCount={items.length} />
    </div>
  );
}
