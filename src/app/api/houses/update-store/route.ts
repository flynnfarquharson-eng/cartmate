import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { houseId, storeChain, storeName, storeNo } = await request.json();

  if (!houseId || !storeChain || !storeName) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("houses")
    .update({
      store_chain: storeChain,
      store_name: storeName,
      store_no: storeNo,
    })
    .eq("id", houseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
