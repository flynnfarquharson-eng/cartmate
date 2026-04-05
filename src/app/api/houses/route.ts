import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { generateInviteCode, getRandomAvatarColor } from "@/lib/utils";

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { houseName, address, memberName, email } = await request.json();

  if (!houseName || !address || !memberName || !email) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // Generate unique invite code
  let inviteCode = generateInviteCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from("houses")
      .select("id")
      .eq("invite_code", inviteCode)
      .single();
    if (!existing) break;
    inviteCode = generateInviteCode();
    attempts++;
  }

  // Create house
  const { data: house, error: houseError } = await supabase
    .from("houses")
    .insert({ name: houseName, address, invite_code: inviteCode })
    .select()
    .single();

  if (houseError) {
    return NextResponse.json({ error: houseError.message }, { status: 500 });
  }

  // Create founding member
  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      house_id: house.id,
      name: memberName,
      email,
      avatar_color: getRandomAvatarColor(),
    })
    .select()
    .single();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // Create initial open order
  await supabase.from("orders").insert({ house_id: house.id, status: "open" });

  return NextResponse.json({ house, member });
}
