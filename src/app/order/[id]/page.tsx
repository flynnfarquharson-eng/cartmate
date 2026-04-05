"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatPrice, getHouseId } from "@/lib/utils";
import type { Member, Item, Payment } from "@/lib/database.types";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Card from "@/components/Card";

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const [members, setMembers] = useState<Member[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const houseId = getHouseId();
      if (!houseId) {
        router.replace("/");
        return;
      }

      const [membersRes, itemsRes, paymentsRes] = await Promise.all([
        supabase.from("members").select("*").eq("house_id", houseId),
        supabase.from("items").select("*").eq("order_id", orderId),
        supabase.from("payments").select("*").eq("order_id", orderId),
      ]);

      if (membersRes.data) setMembers(membersRes.data);
      if (itemsRes.data) setItems(itemsRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      setLoading(false);
    }
    load();
  }, [orderId, router]);

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

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-primary px-4 py-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-green-100">Order Confirmed</span>
        </div>
        <h1 className="text-2xl font-bold">Shopping List</h1>
        <p className="text-green-100 text-sm mt-1">
          {items.length} items &middot; {formatPrice(grandTotal)}
        </p>
      </div>

      {/* Shopping list by member */}
      <div className="px-4 pt-4 space-y-3">
        {members
          .filter((m) => itemsByMember[m.id]?.length > 0)
          .map((member) => {
            const memberItems = itemsByMember[member.id];
            const subtotal = memberItems.reduce((sum, i) => sum + Number(i.price), 0);
            const payment = payments.find((p) => p.member_id === member.id);

            return (
              <Card key={member.id}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={member.name} color={member.avatar_color} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{member.name}</span>
                      {payment?.status === "paid" ? (
                        <Badge variant="paid">Paid {formatPrice(Number(payment.amount))}</Badge>
                      ) : (
                        <Badge variant="pending">Pending</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {memberItems.length} item{memberItems.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="font-bold text-gray-900">{formatPrice(subtotal)}</span>
                </div>

                <div className="space-y-1.5">
                  {memberItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded border-2 border-gray-300 shrink-0" />
                        <span className="text-sm text-gray-700">{item.name}</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatPrice(Number(item.price))}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
      </div>

      {/* Payment summary */}
      <div className="px-4 pt-4">
        <Card>
          <h2 className="font-semibold text-gray-900 mb-3">Payment Summary</h2>
          <div className="space-y-2">
            {members
              .filter((m) => itemsByMember[m.id]?.length > 0)
              .map((member) => {
                const payment = payments.find((p) => p.member_id === member.id);
                const subtotal = (itemsByMember[member.id] || []).reduce(
                  (sum, i) => sum + Number(i.price),
                  0
                );
                return (
                  <div key={member.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <Avatar name={member.name} color={member.avatar_color} size="sm" />
                      <span className="text-sm text-gray-700">{member.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatPrice(subtotal)}</span>
                      {payment?.status === "paid" ? (
                        <Badge variant="paid">Paid</Badge>
                      ) : (
                        <Badge variant="pending">Pending</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            <hr className="border-gray-100 my-2" />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Back to cart */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-lg mx-auto">
          <Button onClick={() => router.push("/cart")} variant="secondary">
            Back to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}
