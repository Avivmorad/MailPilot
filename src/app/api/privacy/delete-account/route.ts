import { NextResponse } from "next/server";

import {
  createSupabaseDeletionPort,
  deleteAccountForUser,
  deleteAccountRequestSchema,
} from "@/lib/privacy/deletion";
import { getSessionUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = deleteAccountRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    await deleteAccountForUser(user.id, createSupabaseDeletionPort());
    return NextResponse.json({ ok: true, redirectTo: `${origin}/` });
  } catch {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
