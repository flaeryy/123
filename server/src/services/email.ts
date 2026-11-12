import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

if (!apiKey) {
  throw new Error("Nedostaje RESEND_API_KEY u .env datoteci.");
}

if (!emailFrom) {
  throw new Error("Nedostaje EMAIL_FROM u .env datoteci.");
}

const resend = new Resend(apiKey);

// Slanje e-maila preko Resenda
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
) {
  const { data, error } = await resend.emails.send({
    from: emailFrom!,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Slanje e-maila nije uspjelo: ${error.message}`);
  }

  return data;
}
