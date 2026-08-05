import { sendAccountActivatedEmail } from "./src/lib/email";

async function test() {
  console.log("Testing email...");
  const result = await sendAccountActivatedEmail(process.env.SMTP_USER || "test@example.com", "Studio");
  console.log("Result:", result);
}

test();
