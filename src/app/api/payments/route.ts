import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { orderId, memberId, amount, memberEmail } = await request.json();

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  if (!orderId || !memberId || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "aud",
          product_data: {
            name: "CartMate Grocery Order",
            description: "Your share of the grocery order",
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart?canceled=true`,
    customer_email: memberEmail,
    metadata: {
      order_id: orderId,
      member_id: memberId,
    },
  });

  // Create payment record
  const { error } = await supabase.from("payments").insert({
    order_id: orderId,
    member_id: memberId,
    amount,
    stripe_payment_intent_id: session.id,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
