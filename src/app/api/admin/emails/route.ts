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
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const type = request.nextUrl.searchParams.get("type");

  let snap;
  if (email) {
    snap = await db.collection("email_log").where("to", "==", email).limit(limit).get();
  } else if (type) {
    snap = await db.collection("email_log").where("type", "==", type).limit(limit).get();
  } else {
    snap = await db.collection("email_log").orderBy("createdAt", "desc").limit(limit).get();
  }

  const items = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) =>
      String((b as { createdAt?: string }).createdAt || "").localeCompare(
        String((a as { createdAt?: string }).createdAt || ""),
      ),
    );

  return NextResponse.json({ success: true, items });
}
