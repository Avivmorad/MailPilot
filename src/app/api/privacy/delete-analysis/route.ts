import { NextResponse } from "next/server";

import {
  createSupabaseDeletionPort,
  deleteAnalysisDataForUser,
  deleteAnalysisRequestSchema,
} from "@/lib/privacy/deletion";
import { getSessionUser } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = deleteAnalysisRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }

  try {
    const deleted = await deleteAnalysisDataForUser(user.id, createSupabaseDeletionPort());
    return NextResponse.json({ ok: true, deleted });
  } catch {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
