import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: house, error } = await supabase
    .from("houses")
    .select("id, name")
    .eq("invite_code", code.toUpperCase())
    .single();

  if (error || !house) {
    return NextResponse.json({ error: "House not found" }, { status: 404 });
  }

  return NextResponse.json({ house });
}
