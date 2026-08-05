import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { sendSubscriptionExpiredEmail } from "@/lib/email";

// This endpoint can be hit via a CRON job (e.g. Vercel Cron, GitHub Actions)
// or manually by the admin to check for expired subscriptions and send emails.
export async function GET(request: NextRequest) {
  // To secure this endpoint, you could check for a secret cron token in the headers
  // For example: if (request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) ...
  
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
  }

  try {
    const now = new Date();
    
    // Get all users who have an active (or recently expired) subscription
    const snapshot = await db.collection("users")
      .where("subscriptionPlan", "in", ["studio", "team"])
      .get();
      
    let expiredCount = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const expiresAt = data.subscriptionExpiresAt;
      
      // If they don't have an expiration date, skip them
      if (!expiresAt) continue;
      
      const expiryDate = new Date(expiresAt);
      
      // If the subscription has expired AND we haven't already marked them as expired
      if (expiryDate < now && data.expirationEmailSent !== true) {
        // Send email
        const planName = data.subscriptionPlan === "studio" ? "Studio" : "Team";
        
        try {
          await sendSubscriptionExpiredEmail(data.email, planName);
          
          // Mark as sent and downgrade their plan
          batch.update(doc.ref, {
            expirationEmailSent: true,
            subscriptionPlan: "none",
          });
          
          expiredCount++;
        } catch (emailErr) {
          console.error("Failed to send expiration email to", data.email, emailErr);
        }
      }
    }

    // Commit all updates
    if (expiredCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      message: `Checked expirations. Processed ${expiredCount} expired accounts.` 
    });
    
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
