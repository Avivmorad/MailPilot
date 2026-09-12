import { NextResponse } from "next/server";

import {
  getScanPreferences,
  patchScanPreferencesSchema,
  updateScanPreferences,
} from "@/lib/settings/preferences";
import { getSessionUser } from "@/lib/supabase/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  try {
    const preferences = await getScanPreferences(user.id);
    return NextResponse.json({ preferences }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  let json: unknown = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    json = await request.json().catch(() => ({}));
  }

  const parsed = patchScanPreferencesSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
  }

  try {
    const preferences = await updateScanPreferences(user.id, parsed.data);
    return NextResponse.json({ preferences });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
