import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireActiveClientSession } from "@/lib/require-client-session";
import { publicMaintenanceResponse } from "@/lib/maintenance";

export async function GET() {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;
  const gate = await requireActiveClientSession();
  if (!gate.ok) return gate.response;

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not configured." }, { status: 503 });
  }

  const userDoc = await db.collection("users").doc(gate.email).get();
  if (!userDoc.exists) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const user = userDoc.data()!;
  return NextResponse.json({
    success: true,
    user: {
      email: gate.email,
      name: String(user.name || gate.email.split("@")[0] || "Member"),
      sid: gate.sid,
    },
  });
}
