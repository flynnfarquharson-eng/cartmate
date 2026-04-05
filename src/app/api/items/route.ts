import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { orderId, memberId, name, price } = await request.json();

  if (!orderId || !memberId || !name || price == null) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("items")
    .insert({ order_id: orderId, member_id: memberId, name, price })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("id");
  const memberId = searchParams.get("memberId");

  if (!itemId || !memberId) {
    return NextResponse.json({ error: "Item ID and member ID are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify ownership
  const { data: item } = await supabase
    .from("items")
    .select("member_id")
    .eq("id", itemId)
    .single();

  if (!item || item.member_id !== memberId) {
    return NextResponse.json({ error: "You can only delete your own items" }, { status: 403 });
  }

  const { error } = await supabase.from("items").delete().eq("id", itemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
