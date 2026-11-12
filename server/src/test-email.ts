
import "dotenv/config";
import { sendEmail } from "./services/email.js";

async function testEmail() {
  try {
    const result = await sendEmail(
      "bozo.nad123@gmail.com",
      "Testni e-mail - Belot",
      "<h1>Pozdrav!</h1><p>Resend uspješno šalje e-mail za Belot aplikaciju.</p>",
    );

    console.log("E-mail uspješno poslan:", result);
  } catch (error) {
    console.error("Greška:", error);
  }
}

testEmail();
