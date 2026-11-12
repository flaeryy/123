import { createHash, randomBytes } from "node:crypto";

// Generiranje sigurnosnog tokena za potvrdu e-mail adrese
export function createEmailVerificationToken() {
  const token = randomBytes(32).toString("hex");

  // U bazu spremamo samo hash tokena
  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  // Token vrijedi 30 minuta
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  return {
    token,
    tokenHash,
    expiresAt,
  };
}
