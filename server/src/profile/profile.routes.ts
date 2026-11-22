import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { getSessionUser } from "../auth/auth-service.js";

// Javni profil nikad ne vraca email, token ni druge podatke za prijavu.
const publicFields = {
  id: users.id,
  username: users.username,
  createdAt: users.createdAt,
  rating: users.rating,
  gamesPlayed: users.gamesPlayed,
  wins: users.wins,
  losses: users.losses,
  avatarId: users.avatarId,
  bestWinStreak: users.bestWinStreak,
};

function getBearerToken(header: string | undefined): string {
  return header?.startsWith("Bearer ") ? header.slice(7) : "";
}

export function registerProfileRoutes(app: FastifyInstance) {
  // Pregled vlastitog ili tudeg profila. Nema povijesti partija.
  app.get<{ Params: { userId: string } }>("/profiles/:userId", async (request, reply) => {
    const userId = Number(request.params.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return reply.code(400).send({ success: false, message: "Neispravan ID igraca." });
    }

    const [profile] = await db.select(publicFields).from(users).where(eq(users.id, userId)).limit(1);
    if (!profile) {
      return reply.code(404).send({ success: false, message: "Igrac nije pronaden." });
    }

    return {
      success: true,
      profile: {
        ...profile,
        winRate: profile.gamesPlayed > 0
          ? Math.round((profile.wins / profile.gamesPlayed) * 1000) / 10
          : 0,
      },
    };
  });

  // Tijekom partije klijent zna korisnicko ime, ali ne mora znati korisnicki ID.
  app.get<{ Params: { username: string } }>("/profiles/by-name/:username", async (request, reply) => {
    const username = request.params.username;
    if (!username || username.length > 30) return reply.code(400).send({ success: false });
    const [profile] = await db.select(publicFields).from(users).where(eq(users.username, username)).limit(1);
    if (!profile) return reply.code(404).send({ success: false, message: "Igrac nije pronaden." });
    return { success: true, profile: { ...profile, winRate: profile.gamesPlayed > 0 ? Math.round(profile.wins / profile.gamesPlayed * 1000) / 10 : 0 } };
  });

  // Avatar smije mijenjati samo vlasnik valjane sesije.
  app.patch<{ Body: { avatarId?: number } }>("/profiles/me/avatar", async (request, reply) => {
    const session = await getSessionUser(getBearerToken(request.headers.authorization));
    if (!session) {
      return reply.code(401).send({ success: false, message: "Potrebna je prijava." });
    }

    const avatarId = request.body?.avatarId;
    if (!Number.isInteger(avatarId) || avatarId === undefined || avatarId < 1 || avatarId > 12) {
      return reply.code(400).send({ success: false, message: "Avatar mora biti izmedu 1 i 12." });
    }

    const [updated] = await db.update(users).set({ avatarId })
      .where(eq(users.id, session.userId)).returning({ avatarId: users.avatarId });
    if (!updated) {
      return reply.code(404).send({ success: false, message: "Igrac nije pronaden." });
    }

    return { success: true, avatarId: updated.avatarId };
  });
}
