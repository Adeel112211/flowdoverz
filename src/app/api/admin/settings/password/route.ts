import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest, verifyAdminPassword } from "@/lib/admin";
import { getDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    if (!(await verifyAdminPassword(currentPassword))) {
      return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 400 });
    }

    await db.collection("settings").doc("admin").set({ password: newPassword }, { merge: true });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
