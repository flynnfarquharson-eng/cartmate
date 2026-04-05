"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMemberId, getHouseId, formatPrice, clearSession } from "@/lib/utils";
import type { Member, Order, Item, Payment } from "@/lib/database.types";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Card from "@/components/Card";

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

  // Real-time subscriptions
  useEffect(() => {
    if (!order?.id) return;

    const itemsChannel = supabase
      .channel("items-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `order_id=eq.${order.id}` },
        () => {
          supabase
            .from("items")
            .select("*")
            .eq("order_id", order.id)
            .then(({ data }) => {
              if (data) setItems(data);
            });
        }
      )
      .subscribe();

    const paymentsChannel = supabase
      .channel("payments-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `order_id=eq.${order.id}` },
        () => {
          supabase
            .from("payments")
            .select("*")
            .eq("order_id", order.id)
            .then(({ data }) => {
              if (data) setPayments(data);
            });
        }
      )
      .subscribe();

    const ordersChannel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        (payload) => {
          setOrder(payload.new as Order);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [order?.id]);

  async function deleteItem(itemId: string) {
    await fetch(`/api/items?id=${itemId}&memberId=${memberId}`, {
      method: "DELETE",
    });
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
      body: JSON.stringify({
        orderId: order.id,
        memberId,
        amount: subtotal + feeShare,
        memberEmail: member?.email,
      }),
    });

    const data = await res.json();
    setPayLoading(false);

    if (data.url) {
      window.location.href = data.url;
    }
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

  function handleLeave() {
    clearSession();
    router.replace("/");
  }

  function shareInviteLink() {
    const url = `${window.location.origin}/join/${inviteCode}`;
    if (navigator.share) {
      navigator.share({
        title: `Join ${houseName} on CartMate`,
        text: `Join our shared grocery order on CartMate!`,
        url,
      }).catch(() => {});
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

  // Group items by member
  const itemsByMember: Record<string, Item[]> = {};
  items.forEach((item) => {
    if (!itemsByMember[item.member_id]) itemsByMember[item.member_id] = [];
    itemsByMember[item.member_id].push(item);
  });

  const grandTotal = items.reduce((sum, i) => sum + Number(i.price), 0);
  const mySubtotal = items
    .filter((i) => i.member_id === memberId)
    .reduce((sum, i) => sum + Number(i.price), 0);

  const myPayment = payments.find(
    (p) => p.member_id === memberId && p.status === "paid"
  );

  const membersWithItems = members.filter((m) => itemsByMember[m.id]?.length > 0);
  const isLocked = order?.status === "locked";
  const hasItems = items.length > 0;
  const feePerPerson = SERVICE_FEE / Math.max(membersWithItems.length, 1);
  const myTotal = mySubtotal + (mySubtotal > 0 ? feePerPerson : 0);

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{houseName}</h1>
            <p className="text-xs text-gray-500">
              {storeName ? `${storeName} · ` : ""}{members.length} member{members.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="p-2 rounded-xl bg-gray-50 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
            <button
              onClick={handleLeave}
              className="p-2 rounded-xl bg-gray-50 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Invite panel */}
        {showInvite && (
          <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Invite Code</p>
              <span className="font-mono text-xl font-bold tracking-widest text-gray-900">
                {inviteCode}
              </span>
            </div>
            <button
              onClick={shareInviteLink}
              className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
            >
              {copiedLink ? (
                "Link Copied!"
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share Invite Link
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Or share: {window.location.origin}/join/{inviteCode}
            </p>
          </div>
        )}

        {/* Member avatars row */}
        <div className="flex items-center gap-1 mt-3 -mb-1">
          {members.map((m) => (
            <div key={m.id} className="relative">
              <Avatar name={m.name} color={m.avatar_color} size="sm" />
              {itemsByMember[m.id]?.length > 0 && payments.some((p) => p.member_id === m.id && p.status === "paid") && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
              )}
            </div>
          ))}
          <button
            onClick={() => setShowInvite(true)}
            className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}

      {/* Empty state */}
      {!hasItems && !isLocked && (
        <div className="px-4 pt-12 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Your cart is empty</h2>
          <p className="text-sm text-gray-500 mb-6">
            Start adding items and your housemates will see them in real-time
          </p>
          <Button onClick={() => router.push("/shop")}>
            Start Shopping
          </Button>

          {members.length < 2 && (
            <div className="mt-6 bg-blue-50 rounded-xl p-4 text-left">
              <p className="text-sm font-medium text-blue-900 mb-1">Invite your housemates</p>
              <p className="text-xs text-blue-700 mb-3">
                Share the link so they can add their own items
              </p>
              <button
                onClick={shareInviteLink}
                className="w-full bg-blue-600 text-white rounded-xl py-2 text-sm font-semibold"
              >
                {copiedLink ? "Link Copied!" : "Share Invite Link"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grand total + service fee */}
      {hasItems && (
        <div className="px-4 pt-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Order Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(grandTotal + SERVICE_FEE)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Your share</p>
                <p className="text-lg font-semibold text-primary">{formatPrice(myTotal)}</p>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-2 space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Subtotal ({items.length} items)</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Delivery coordination fee</span>
                <span>{formatPrice(SERVICE_FEE)}</span>
              </div>
              {membersWithItems.length > 1 && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Fee split {membersWithItems.length} ways</span>
                  <span>{formatPrice(feePerPerson)}/person</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Members and their items */}
      {hasItems && (
        <div className="px-4 pt-4 space-y-3">
          {members.map((member) => {
            const memberItems = itemsByMember[member.id] || [];
            const subtotal = memberItems.reduce((sum, i) => sum + Number(i.price), 0);
            const isPaid = payments.some(
              (p) => p.member_id === member.id && p.status === "paid"
            );
            const isMe = member.id === memberId;

            if (memberItems.length === 0) return null;

            // Group duplicate items by name+price
            const groupedItems: { item: Item; qty: number }[] = [];
            const seen: Record<string, number> = {};
            memberItems.forEach((item) => {
              const key = `${item.name}|${item.price}`;
              if (seen[key] !== undefined) {
                groupedItems[seen[key]].qty++;
              } else {
                seen[key] = groupedItems.length;
                groupedItems.push({ item, qty: 1 });
              }
            });

            return (
              <Card key={member.id}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={member.name} color={member.avatar_color} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {member.name}
                        {isMe && (
                          <span className="text-xs text-gray-400 font-normal ml-1">(you)</span>
                        )}
                      </span>
                      {isPaid ? (
                        <Badge variant="paid">Paid</Badge>
                      ) : (
                        <Badge variant="pending">Pending</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {memberItems.length} item{memberItems.length !== 1 ? "s" : ""} &middot;{" "}
                      {formatPrice(subtotal)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {groupedItems.map(({ item, qty }) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {qty > 1 && (
                          <span className="text-xs font-bold text-primary bg-green-50 px-1.5 py-0.5 rounded">
                            {qty}x
                          </span>
                        )}
                        <span className="text-sm text-gray-700 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-gray-900">
                          {formatPrice(Number(item.price) * qty)}
                        </span>
                        {isMe && !isLocked && (
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="text-gray-400 hover:text-red-500 p-0.5"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add items button */}
      {!isLocked && hasItems && (
        <div className="px-4 pt-4">
          <button
            onClick={() => router.push("/shop")}
            className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 active:bg-gray-50 transition-colors"
          >
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900">Browse & Add Items</p>
              <p className="text-xs text-gray-500">Search products with prices</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-lg mx-auto">
          {isLocked ? (
            <Button onClick={handlePlaceOrder}>
              Place Order
            </Button>
          ) : myPayment ? (
            <Button disabled>
              You&apos;ve paid {formatPrice(Number(myPayment.amount))}
            </Button>
          ) : mySubtotal > 0 ? (
            <Button onClick={handlePay} disabled={payLoading}>
              {payLoading
                ? "Redirecting to payment..."
                : `Pay ${formatPrice(myTotal)}`}
            </Button>
          ) : hasItems ? (
            <Button onClick={() => router.push("/shop")}>Add Your Items</Button>
          ) : (
            <Button onClick={() => router.push("/shop")}>Start Shopping</Button>
          )}

          {!isLocked && membersWithItems.length > 0 && (
            <p className="text-xs text-gray-400 text-center mt-2">
              {payments.filter((p) => p.status === "paid").length}/{membersWithItems.length} members
              paid
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
