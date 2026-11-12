
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { users, accounts } from "./db/schema.js";
import { hashPassword } from "./services/password.js";

const TEST_PLAYERS = [
  {
    username: "TestIgrac2",
    email: "testigrac2@belot.local",
  },
  {
    username: "TestIgrac3",
    email: "testigrac3@belot.local",
  },
  {
    username: "TestIgrac4",
    email: "testigrac4@belot.local",
  },
];

const PASSWORD = "BelotTest2026!";

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  for (const player of TEST_PLAYERS) {
    const result = await db.transaction(async (tx) => {
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, player.username))
        .limit(1);

      const [existingAccount] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.email, player.email))
        .limit(1);

      if (existingUser || existingAccount) {
        return "preskočen – korisnik ili e-mail već postoji";
      }

      const [newUser] = await tx
        .insert(users)
        .values({ username: player.username })
        .returning({ id: users.id });

      await tx.insert(accounts).values({
        userId: newUser.id,
        email: player.email,
        passwordHash,
        emailVerifiedAt: new Date(),
      });

      return "uspješno dodan";
    });

    console.log(`${player.username}: ${result}`);
  }

  console.log("\nTestni računi su obrađeni.");
  console.log(`Lozinka: ${PASSWORD}`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Greška pri dodavanju testnih igrača:", error);
  process.exit(1);
});
