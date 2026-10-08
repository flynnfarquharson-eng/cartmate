"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setTipSaved(tipId: string, saved: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in again." };

  const { error } = saved
    ? await supabase
        .from("saved_tips")
        .upsert({ user_id: user.id, tip_id: tipId }, { onConflict: "user_id,tip_id" })
    : await supabase.from("saved_tips").delete().eq("user_id", user.id).eq("tip_id", tipId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tips");
  return { ok: true };
}
