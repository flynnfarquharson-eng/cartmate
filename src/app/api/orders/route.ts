import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function PATCH(request: Request) {
  const supabase = createServiceClient();
  const { orderId, status } = await request.json();

  if (!orderId || !status) {
    return NextResponse.json({ error: "Order ID and status are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If confirming, create a new open order for the house
  if (status === "confirmed") {
    const { data: order } = await supabase
      .from("orders")
      .select("house_id")
      .eq("id", orderId)
      .single();

    if (order) {
      await supabase
        .from("orders")
        .insert({ house_id: order.house_id, status: "open" });
    }
  }

  return NextResponse.json({ success: true });
}
