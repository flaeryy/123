import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { gamePlayers, games, users } from "../db/schema.js";

type FinishedMatch = {
  roomCode: string;
  winnerTeam: 1 | 2;
  team1Score: number;
  team2Score: number;
  callingTeam: number;
  contractMade: boolean | null;
  declarationPoints: number;
  team1Bela: number;
  team2Bela: number;
};

// Zavrsavanje meca i statistika moraju biti u istoj transakciji.
// Ako spremanje jednog igraca ne uspije, ne spremamo ni rezultat meca.
export async function finishMatchWithStats(result: FinishedMatch): Promise<void> {
  await db.transaction(async (tx) => {
    // Uvjet statusa osigurava da ponovljeni Socket.IO poziv ne broji pobjedu dvaput.
    const [finishedGame] = await tx
      .update(games)
      .set({
        status: "finished",
        finishedAt: new Date(),
        winnerTeam: result.winnerTeam,
        finishReason: "completed",
        team1Score: result.team1Score,
        team2Score: result.team2Score,
        callingTeam: result.callingTeam,
        contractMade: result.contractMade,
        declarationPoints: result.declarationPoints,
        team1Bela: result.team1Bela,
        team2Bela: result.team2Bela,
      })
      .where(and(eq(games.roomCode, result.roomCode), eq(games.status, "playing")))
      .returning({ id: games.id });

    if (!finishedGame) {
      throw new Error("Mec nije pronaden ili je vec zavrsen.");
    }

    const participants = await tx
      .select({ userId: gamePlayers.userId, seat: gamePlayers.seat })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, finishedGame.id));

    // Ne smijemo dodijeliti nepotpunu statistiku ako nedostaje neki igrac.
    if (participants.length !== 4 || new Set(participants.map((p) => p.seat)).size !== 4) {
      throw new Error("Za statistiku meca potrebna su cetiri igraca.");
    }

    for (const player of participants) {
      // U Belotu su igraci 1 i 3 MI, a 2 i 4 VI.
      const team = player.seat % 2 === 1 ? 1 : 2;
      const won = team === result.winnerTeam;

      await tx
        .update(users)
        .set({
          gamesPlayed: sql`${users.gamesPlayed} + 1`,
          wins: won ? sql`${users.wins} + 1` : users.wins,
          losses: won ? users.losses : sql`${users.losses} + 1`,
          currentWinStreak: won ? sql`${users.currentWinStreak} + 1` : 0,
          bestWinStreak: won
            ? sql`GREATEST(${users.bestWinStreak}, ${users.currentWinStreak} + 1)`
            : users.bestWinStreak,
        })
        .where(eq(users.id, player.userId));
    }
  });
}
