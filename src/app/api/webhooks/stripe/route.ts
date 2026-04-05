import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase-server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { order_id, member_id } = session.metadata || {};

    if (!order_id || !member_id) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Mark payment as paid
    await supabase
      .from("payments")
      .update({ status: "paid" })
      .eq("stripe_payment_intent_id", session.id);

    // Check if all members have paid
    await supabase
      .from("members")
      .select("id")
      .eq(
        "house_id",
        (
          await supabase
            .from("orders")
            .select("house_id")
            .eq("id", order_id)
            .single()
        ).data?.house_id || ""
      );

    // Get members who have items in this order
    const { data: itemMembers } = await supabase
      .from("items")
      .select("member_id")
      .eq("order_id", order_id);

    const memberIdsWithItems = Array.from(
      new Set((itemMembers || []).map((i) => i.member_id))
    );

    // Check payments for members with items
    const { data: payments } = await supabase
      .from("payments")
      .select("member_id, status")
      .eq("order_id", order_id)
      .eq("status", "paid");

    const paidMemberIds = new Set((payments || []).map((p) => p.member_id));
    const allPaid = memberIdsWithItems.every((id) => paidMemberIds.has(id));

    if (allPaid && memberIdsWithItems.length > 0) {
      await supabase
        .from("orders")
        .update({ status: "locked" })
        .eq("id", order_id);
    }
  }

  return NextResponse.json({ received: true });
}
