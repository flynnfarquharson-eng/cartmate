import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getRandomAvatarColor } from "@/lib/utils";

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { houseId, name, email } = await request.json();

  if (!houseId || !name || !email) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const { data: member, error } = await supabase
    .from("members")
    .insert({
      house_id: houseId,
      name,
      email,
      avatar_color: getRandomAvatarColor(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ member });
}
