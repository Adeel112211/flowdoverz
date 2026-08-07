import { NextResponse } from "next/server";
import { getClientSessionFromCookies } from "@/lib/client-session";
import { getDb } from "@/lib/firebase-admin";

export async function GET() {
  const session = await getClientSessionFromCookies();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not configured." }, { status: 503 });
  }

  const userDoc = await db.collection("users").doc(session.email).get();
  if (!userDoc.exists) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const user = userDoc.data()!;
  return NextResponse.json({
    success: true,
    user: {
      email: session.email,
      name: String(user.name || session.email.split("@")[0] || "Member"),
      sid: session.sid,
    },
  });
}
