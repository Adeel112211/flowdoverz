import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { getDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 100), 500);
  const action = request.nextUrl.searchParams.get("action");

  let query = db.collection("admin_activity").orderBy("createdAt", "desc").limit(limit);
  if (action) {
    query = db.collection("admin_activity").where("action", "==", action).orderBy("createdAt", "desc").limit(limit);
  }

  try {
    const snap = await query.get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ success: true, items });
  } catch {
    const snap = await db.collection("admin_activity").limit(limit).get();
    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) =>
        String((b as { createdAt?: string }).createdAt || "").localeCompare(
          String((a as { createdAt?: string }).createdAt || ""),
        ),
      );
    return NextResponse.json({ success: true, items });
  }
}
