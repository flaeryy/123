
import "dotenv/config";
import { eq } from "drizzle-orm";

import { db, pool } from "./db/index.js";
import { accounts, users } from "./db/schema.js";
import { verifyPassword } from "./services/password.js";

async function main() {
  const email = process.env.BELOT_TEST_EMAIL?.trim().toLowerCase();
  const password = process.env.BELOT_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error("Nedostaju testni podaci za prijavu.");
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const parsedUrl = new URL(databaseUrl);

    console.log("Baza:", {
      host: parsedUrl.hostname,
      port: parsedUrl.port,
      database: parsedUrl.pathname.slice(1),
    });
  }

  const [account] = await db
    .select({
      username: users.username,
      email: accounts.email,
      passwordHash: accounts.passwordHash,
      emailVerifiedAt: accounts.emailVerifiedAt,
    })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(eq(accounts.email, email))
    .limit(1);

  console.log("\nREZULTAT PROVJERE RAČUNA:");
  console.log("Račun pronađen:", Boolean(account));

  if (!account) {
    console.log("E-mail postoji u testnim varijablama, ali račun nije pronađen u ovoj bazi.");
    return;
  }

  console.log("Korisničko ime:", account.username);
  console.log("Hash lozinke postoji:", Boolean(account.passwordHash));
  console.log("E-mail potvrđen:", Boolean(account.emailVerifiedAt));

  if (account.passwordHash) {
    const passwordMatches = await verifyPassword(
      account.passwordHash,
      password,
    );

    console.log("Lozinka odgovara:", passwordMatches);
  }
}

main()
  .catch((error) => {
    console.error("Greška dijagnostike:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
