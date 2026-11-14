
import { randomBytes, createHash } from "node:crypto";
import { and, eq, isNull, gt } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";

import { db } from "../db/index.js";
import {
  users,
  accounts,
  emailVerificationTokens,
  sessions,
} from "../db/schema.js";

import {
  hashPassword,
  verifyPassword,
} from "../services/password.js";

import { sendEmail } from "../services/email.js";
import { createEmailVerificationToken } from "./auth-tokens.js";

const googleOAuthClient = new OAuth2Client();

// Standardizirana greška autentifikacije
export class AuthError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// Hashiranje sigurnosnih tokena
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function createSession(account: {
  accountId: number;
  userId: number;
  username: string;
  email: string;
}) {
  const sessionToken = randomBytes(32).toString("hex");
  const sessionTokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    accountId: account.accountId,
    tokenHash: sessionTokenHash,
    expiresAt,
  });

  return {
    success: true,
    sessionToken,
    expiresAt,
    user: {
      id: account.userId,
      username: account.username,
      email: account.email,
    },
  };
}

// Registracija novog korisnika
export async function registerUser(
  username: string,
  email: string,
  password: string,
) {
  username = username.trim();
  email = email.trim().toLowerCase();

  if (!/^[\p{L}\p{N}_-]{3,30}$/u.test(username)) {
    throw new AuthError(400, "Korisničko ime mora imati 3–30 znakova.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError(400, "E-mail adresa nije ispravna.");
  }

  if (password.length < 8 || password.length > 128) {
    throw new AuthError(400, "Lozinka mora imati 8–128 znakova.");
  }

  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUsername.length > 0) {
    throw new AuthError(409, "Korisničko ime je već zauzeto.");
  }

  const existingEmail = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (existingEmail.length > 0) {
    throw new AuthError(409, "E-mail adresa je već registrirana.");
  }

  const passwordHash = await hashPassword(password);
  const verification = createEmailVerificationToken();

  // Korisnika, račun i token spremamo zajedno
  let userId: number;

  try {
    const result = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({ username })
        .returning({ id: users.id });

      const [newAccount] = await tx
        .insert(accounts)
        .values({
          userId: newUser.id,
          email,
          passwordHash,
        })
        .returning({ id: accounts.id });

      await tx.insert(emailVerificationTokens).values({
        accountId: newAccount.id,
        tokenHash: verification.tokenHash,
        expiresAt: verification.expiresAt,
      });

      return { userId: newUser.id };
    });

    userId = result.userId;
  } catch (error) {
    // Zaštita od istovremenih registracija s istim podacima
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AuthError(409, "Korisničko ime ili e-mail već postoje.");
    }

    throw error;
  }

  // Slanje poveznice za potvrdu e-maila
  const verificationUrl = new URL(
    "/auth/verify-email",
    process.env.API_URL ?? "http://localhost:3001",
  );

  verificationUrl.searchParams.set("token", verification.token);

  try {
    await sendEmail(
      email,
      "Potvrdi svoju Belot registraciju",
      `
        <h2>Dobrodošao u Belot!</h2>
        <p>Za potvrdu svoje e-mail adrese klikni na poveznicu:</p>
        <p><a href="${verificationUrl.toString()}">Potvrdi e-mail adresu</a></p>
        <p>Poveznica vrijedi 30 minuta.</p>
      `,
    );
  } catch (error) {
    // Ako slanje ne uspije, uklanjamo nepotvrđeni račun
    await db.delete(users).where(eq(users.id, userId));
    throw new AuthError(
      503,
      "Slanje potvrde e-maila nije uspjelo. Pokušaj ponovno.",
    );
  }

  return {
    success: true,
    message: "Registracija je uspješna. Provjeri e-mail za potvrdu.",
  };
}

// Potvrda e-mail adrese
export async function verifyEmail(token: string) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    throw new AuthError(400, "Neispravna poveznica za potvrdu.");
  }

  const tokenHash = hashToken(token);

  const [verification] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  if (!verification) {
    throw new AuthError(400, "Poveznica nije valjana.");
  }

  if (verification.usedAt) {
    throw new AuthError(400, "Poveznica je već iskorištena.");
  }

  if (verification.expiresAt.getTime() <= Date.now()) {
    throw new AuthError(400, "Poveznica je istekla.");
  }

  await db.transaction(async (tx) => {
    // Označavanje tokena kao iskorištenog
    const [claimedToken] = await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokens.id, verification.id),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, new Date()),
        ),
      )
      .returning({ accountId: emailVerificationTokens.accountId });

    if (!claimedToken) {
      throw new AuthError(400, "Poveznica više nije valjana.");
    }

    await tx
      .update(accounts)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(accounts.id, claimedToken.accountId));
  });

  return {
    success: true,
    message: "E-mail adresa je uspješno potvrđena.",
  };
}

// Prijava korisnika
export async function loginUser(email: string, password: string) {
  email = email.trim().toLowerCase();

  const [account] = await db
    .select({
      accountId: accounts.id,
      userId: users.id,
      username: users.username,
      email: accounts.email,
      passwordHash: accounts.passwordHash,
      emailVerifiedAt: accounts.emailVerifiedAt,
    })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(eq(accounts.email, email))
    .limit(1);

  if (!account || !account.passwordHash) {
    throw new AuthError(401, "Neispravna e-mail adresa ili lozinka.");
  }

  const passwordIsCorrect = await verifyPassword(
    account.passwordHash,
    password,
  );

  if (!passwordIsCorrect) {
    throw new AuthError(401, "Neispravna e-mail adresa ili lozinka.");
  }

  if (!account.emailVerifiedAt) {
    throw new AuthError(403, "Prvo potvrdi svoju e-mail adresu.");
  }

  return createSession(account);
}

export async function loginWithGoogle(credential: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new AuthError(503, "Google prijava još nije konfigurirana.");
  }

  let payload;

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AuthError(401, "Google prijava nije valjana. Pokušaj ponovno.");
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new AuthError(401, "Google račun nema potvrđenu e-mail adresu.");
  }

  const email = payload.email.trim().toLowerCase();
  const [googleAccount] = await db
    .select({
      accountId: accounts.id,
      userId: users.id,
      username: users.username,
      email: accounts.email,
    })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(eq(accounts.googleId, payload.sub))
    .limit(1);

  if (googleAccount) {
    return createSession(googleAccount);
  }

  const [emailAccount] = await db
    .select({
      accountId: accounts.id,
      userId: users.id,
      username: users.username,
      email: accounts.email,
      googleId: accounts.googleId,
      emailVerifiedAt: accounts.emailVerifiedAt,
    })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(eq(accounts.email, email))
    .limit(1);

  if (emailAccount) {
    if (emailAccount.googleId && emailAccount.googleId !== payload.sub) {
      throw new AuthError(409, "Ovaj e-mail već je povezan s drugim Google računom.");
    }

    await db
      .update(accounts)
      .set({
        googleId: payload.sub,
        emailVerifiedAt: emailAccount.emailVerifiedAt ?? new Date(),
      })
      .where(eq(accounts.id, emailAccount.accountId));

    return createSession(emailAccount);
  }

  const suggestedName = (payload.name ?? email.split("@")[0])
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 30);
  const baseUsername = suggestedName.length >= 3
    ? suggestedName
    : `google${randomBytes(3).toString("hex")}`;

  let username = baseUsername;
  let suffix = 0;

  while (
    (await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1)).length > 0
  ) {
    suffix += 1;
    const suffixText = `_${suffix}`;
    username = `${baseUsername.slice(0, 30 - suffixText.length)}${suffixText}`;
  }

  try {
    const account = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({ username })
        .returning({ id: users.id });

      const [newAccount] = await tx
        .insert(accounts)
        .values({
          userId: newUser.id,
          email,
          googleId: payload.sub,
          emailVerifiedAt: new Date(),
        })
        .returning({ id: accounts.id });

      return {
        accountId: newAccount.id,
        userId: newUser.id,
        username,
        email,
      };
    });

    return createSession(account);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AuthError(409, "Google račun je već registriran. Pokušaj se prijaviti ponovno.");
    }

    throw error;
  }
}

// Odjava i poništavanje sesije
export async function logoutUser(sessionToken: string) {
  if (!sessionToken || !/^[a-f0-9]{64}$/i.test(sessionToken)) {
    throw new AuthError(400, "Neispravan token sesije.");
  }

  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashToken(sessionToken)));

  return {
    success: true,
    message: "Uspješno si se odjavio.",
  };
}

// Dohvaćanje korisnika na temelju valjane sesije
export async function getSessionUser(sessionToken: string) {
  if (!sessionToken || !/^[a-f0-9]{64}$/i.test(sessionToken)) {
    return null;
  }

  const [sessionUser] = await db
    .select({
      accountId: accounts.id,
      userId: users.id,
      username: users.username,
      email: accounts.email,
    })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(sessionToken)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return sessionUser ?? null;
}