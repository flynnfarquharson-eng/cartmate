import "server-only";
import type { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/env";

/**
 * Allows Vercel Cron (which sends "Authorization: Bearer <CRON_SECRET>"),
 * or the admin opening the URL in a browser while logged in.
 */
export async function isCronOrAdmin(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;
  const user = await getUser();
  return isAdminEmail(user?.email);
}
