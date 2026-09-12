import { NextResponse } from "next/server";

import { DigestQueryError, getLatestDigestForUser } from "@/lib/digest/queries";
import { getSessionUser } from "@/lib/supabase/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  try {
    const digest = await getLatestDigestForUser(user.id);
    return NextResponse.json({ digest }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DigestQueryError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
