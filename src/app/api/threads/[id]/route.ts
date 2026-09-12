import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/supabase/auth";
import { getThreadDetailForUser, ThreadQueryError } from "@/lib/threads/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const thread = await getThreadDetailForUser(user.id, id);
    if (!thread) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof ThreadQueryError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
