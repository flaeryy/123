
import "dotenv/config";
import { eq } from "drizzle-orm";

import { db, pool } from "./db/index.js";
import { accounts, users } from "./db/schema.js";
import { hashPassword } from "./services/password.js";

async function main() {
  const email = process.env.BELOT_TEST_EMAIL?.trim().toLowerCase();
  const password = process.env.BELOT_TEST_PASSWORD;

  if (!email || !password || password.length < 8) {
    throw new Error("Nedostaju ispravni testni podaci.");
  }

  const passwordHash = await hashPassword(password);

  const result = await db
    .update(accounts)
    .set({ passwordHash })
    .where(eq(accounts.email, email))
    .returning({ id: accounts.id });

  if (result.length === 0) {
    throw new Error("Korisnički račun nije pronađen.");
  }

  console.log("Testna lozinka uspješno je promijenjena.");
}

main()
  .catch((error) => {
    console.error("Promjena lozinke nije uspjela:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
