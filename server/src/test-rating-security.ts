
import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { eq, inArray } from "drizzle-orm";

import { db } from "./db/index.js";
import { users, accounts, sessions, games } from "./db/schema.js";

type Response = {
  success: boolean;
  message?: string;
  room?: {
    code: string;
    players: Array<{
      userId: number;
      rating: number;
    }>;
  };
};

type TestUser = {
  id: number;
  token: string;
};

const API_URL = "http://127.0.0.1:3001";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function emitAck(
  socket: Socket,
  event: string,
  data?: unknown,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Događaj ${event} nije odgovorio.`)),
      5000,
    );

    const callback = (response: Response) => {
      clearTimeout(timer);
      resolve(response);
    };

    if (data === undefined) {
      socket.emit(event, callback);
    } else {
      socket.emit(event, data, callback);
    }
  });
}

async function connectSocket(token: string): Promise<Socket> {
  const socket = io(API_URL, {
    auth: { token },
    reconnection: false,
  });

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  return socket;
}

// Stvaranje privremenog testnog korisnika i njegove sesije.
async function createTestUser(
  username: string,
  rating: number,
): Promise<TestUser> {
  const [user] = await db
    .insert(users)
    .values({
      username,
      rating,
    })
    .returning({ id: users.id });

  const [account] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      email: `${username.toLowerCase()}@example.invalid`,
      passwordHash: null,
      emailVerifiedAt: new Date(),
    })
    .returning({ id: accounts.id });

  const token = randomBytes(32).toString("hex");

  await db.insert(sessions).values({
    accountId: account.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  return {
    id: user.id,
    token,
  };
}

async function main() {
  const suffix = randomBytes(5).toString("hex");

  const testUsers: TestUser[] = [];
  const sockets: Socket[] = [];
  const roomCodes: string[] = [];

  try {
    // Stvaranje triju privremenih korisnika s različitim rejtingom.
    const host = await createTestUser(`Host${suffix}`, 10);
    testUsers.push(host);

    const player4 = await createTestUser(`Igrac4${suffix}`, 4);
    testUsers.push(player4);

    const player5 = await createTestUser(`Igrac5${suffix}`, 5);
    testUsers.push(player5);

    // Spajanje na server.
    const hostSocket = await connectSocket(host.token);
    sockets.push(hostSocket);

    const player4Socket = await connectSocket(player4.token);
    sockets.push(player4Socket);

    const player5Socket = await connectSocket(player5.token);
    sockets.push(player5Socket);

    // Domaćin stvara javnu sobu s minimalnim rejtingom 5.
    const created = await emitAck(hostSocket, "create_room", {
      isPublic: true,
      minRating: 5,
    });

    if (!created.success || !created.room) {
      throw new Error(created.message ?? "Kreiranje sobe nije uspjelo.");
    }

    const roomCode = created.room.code;
    roomCodes.push(roomCode);

    // TEST 1: Igrač s rejtingom 4 pokušava poslati lažni rejting 10.
    const rejected = await emitAck(player4Socket, "join_room", {
      roomCode,
      rating: 10,
    });

    if (rejected.success) {
      throw new Error("Server je prihvatio lažni rejting igrača.");
    }

    if (
      rejected.message !==
      "Tvoj rejting je prenizak za ulazak u ovu sobu."
    ) {
      throw new Error(
        `Neočekivano odbijanje: ${rejected.message ?? "bez poruke"}`,
      );
    }

    console.log(
      "TEST 1 - lažni rejting 10 ne zaobilazi stvarni rejting 4: PROŠAO",
    );

    // TEST 2: Igrač s rejtingom 5 ulazi u sobu s minimumom 5.
    const accepted = await emitAck(player5Socket, "join_room", {
      roomCode,
      rating: 10,
    });

    if (!accepted.success || !accepted.room) {
      throw new Error(
        accepted.message ?? "Igrač s rejtingom 5 nije prihvaćen.",
      );
    }

    const joinedPlayer = accepted.room.players.find(
      (player) => player.userId === player5.id,
    );

    if (!joinedPlayer || joinedPlayer.rating !== 5) {
      throw new Error(
        "Server nije zadržao stvarni rejting igrača iz baze.",
      );
    }

    console.log(
      "TEST 2 - rejting 5 prihvaćen, lažni rejting 10 zanemaren: PROŠAO",
    );

    console.log("\nSvi Socket.IO testovi zaštite rejtinga su prošli!");
  } finally {
    // Prekid testnih veza.
    for (const socket of sockets) {
      socket.disconnect();
    }

    // Uklanjanje testnih partija.
    if (roomCodes.length > 0) {
      await db.delete(games).where(inArray(games.roomCode, roomCodes));
    }

    // Uklanjanje privremenih korisnika i povezanih računa i sesija.
    const userIds = testUsers.map((user) => user.id);

    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds));
    }
  }
}

main()
  .catch((error) => {
    console.error("\nTEST NIJE PROŠAO:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { pool } = await import("./db/index.js");
    await pool.end();
  });
