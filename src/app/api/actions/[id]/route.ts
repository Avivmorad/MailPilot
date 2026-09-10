import { NextResponse } from "next/server";

import { ActionMutationError, patchActionForUser } from "@/lib/actions/mutations";
import { actionPatchSchema } from "@/lib/actions/patch-schema";
import { getSessionUser } from "@/lib/supabase/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }
  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = actionPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_patch" }, { status: 400 });
  }
  try {
    const action = await patchActionForUser(user.id, id, parsed.data);
    return NextResponse.json({ action });
  } catch (error) {
    if (error instanceof ActionMutationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}
