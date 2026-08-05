import { NextResponse } from "next/server";
import { sendAccountActivatedEmail } from "@/lib/email";

export async function GET() {
  const result = await sendAccountActivatedEmail(process.env.SMTP_USER || "test@example.com", "Studio");
  return NextResponse.json({ success: result });
}
