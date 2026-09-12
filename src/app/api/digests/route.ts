import { NextResponse } from "next/server";

import { digestListQuerySchema } from "@/lib/digest/build-digest";
import { DigestQueryError, listDigestsForUser } from "@/lib/digest/queries";
import { getSessionUser } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const parsed = digestListQuerySchema.safeParse({
    limit: new URL(request.url).searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_limit" }, { status: 400 });
  }

  try {
    const items = await listDigestsForUser(user.id, parsed.data.limit);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
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
