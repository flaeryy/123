import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server, type Socket } from "socket.io";
import { db, pool } from "./db/index.js";
import { users, games, gamePlayers, roomMessages } from "./db/schema.js";
import { and, desc, eq, sql } from "drizzle-orm";
import { roomManager, type Room } from "./rooms/room-manager.js";
import { getSessionUser } from "./auth/auth-service.js";
import {
  createGameState,
  passTrump,
  chooseTrump,
  playCard,
  createNextDeal,
  submitDeclarations,
  type GameState,
} from "./game/game-engine.js";

import type { Card, Suit } from "./game/cards.js";
import { getTrickWinner, getLegalCards } from "./game/rules.js";
import { registerAuthRoutes } from "./auth/auth.routes.js";
import { finishMatchWithStats } from "./profile/profile-stats.js";

const app = Fastify({
  logger: true,
});

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

await app.register(cors, {
  origin: frontendUrl,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
});

// Registracija ruta za korisničke račune
registerAuthRoutes(app);

const io = new Server(app.server, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST"],
  },
});

type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof getSessionUser>>
>;

// Provjera korisničke sesije prije uspostavljanja veze
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (typeof token !== "string") {
      return next(new Error("Moraš se prijaviti za pristup igri."));
    }

    const user = await getSessionUser(token);

    if (!user) {
      return next(new Error("Sesija nije valjana ili je istekla."));
    }

    (socket.data as { user?: AuthenticatedUser }).user = user;

    next();
  } catch {
    next(new Error("Provjera prijave nije uspjela."));
  }
});

// Povezuje Socket.IO igrača s ID-em korisnika u bazi
const socketUsers = new Map<string, number>();

type OnlinePlayer = {
  userId: number;
  username: string;
  rating?: number;
};

function getAvailablePlayers(): OnlinePlayer[] {
  const players = new Map<number, OnlinePlayer>();

  for (const socket of io.sockets.sockets.values()) {
    const user = socket.data.user as
      | { userId: number; username: string }
      | undefined;

    if (!user) continue;

    // Korisnik nije slobodan ako je u bilo kojoj sobi.
    if (roomManager.getUserRoom(user.userId)) continue;

    players.set(user.userId, {
      userId: user.userId,
      username: user.username,
      rating: typeof socket.data.rating === "number" ? socket.data.rating : undefined,
    });
  }

  return Array.from(players.values()).sort((a, b) =>
    a.username.localeCompare(b.username, "hr"),
  );
}

function broadcastAvailablePlayers() {
  io.emit("available_players_updated", getAvailablePlayers());
}

// Aktivne partije u memoriji servera, povezane s kodom sobe.
const activeGames = new Map<string, GameState>();
const pendingTrickResolutions = new Set<string>();
const pendingDeclarationReveals = new Set<string>();
const pendingRoomOperations = new Set<string>();
// Jedna aktivna pozivnica po sobi i primatelju; istek nakon 60 sekundi.
const pendingInvites = new Map<string, { senderSocketId: string; targetUserId: number; timer: ReturnType<typeof setTimeout> }>();

type RoomChatMessage = {
  id: number;
  roomCode: string;
  userId: number | null;
  username: string;
  message: string;
  createdAt: Date;
};

async function fetchRoomChatHistory(
  roomCode: string,
  limit = 50,
): Promise<RoomChatMessage[]> {
  const rows = await db
    .select({
      id: roomMessages.id,
      roomCode: roomMessages.roomCode,
      userId: roomMessages.userId,
      username: roomMessages.username,
      message: roomMessages.message,
      createdAt: roomMessages.createdAt,
    })
    .from(roomMessages)
    .where(eq(roomMessages.roomCode, roomCode))
    .orderBy(desc(roomMessages.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt ?? new Date(),
  }));
}

// Svaki igrač dobiva samo svoje karte.
// Karte ostalih igrača, početne ruke za deklaracije
// i preostale karte ostaju skrivene.
function getPlayerGameView(state: GameState, socketId: string) {
  const player = state.players.find((item) => item.socketId === socketId);

  if (!player) {
    throw new Error("Igrač nije dio ove partije.");
  }

  const {
    declarationHands,
    remainingCards,
    pendingDeclarations,
    ...publicState
  } = state;

  if (state.phase === "finished") {
    console.log("PROVJERA ZAVRŠNOG STANJA:");
    console.log("Faza:", state.phase);
    console.log("Konačni rezultat:", state.finalScore);
  }

  return {
    ...publicState,
    remainingCards: [],
    players: state.players.map((item) => ({
      playerNumber: item.playerNumber,
      socketId: item.socketId,
      username: item.username,
      team: item.team,
      isDealer: item.isDealer,
      hand: item.socketId === socketId ? item.hand : [],
    })),
    myHand: player.hand,
  };
}

function seedBelaTestHand(
  state: GameState,
  email: string,
  socketId: string,
): GameState {
  if (
    process.env.NODE_ENV === "production" ||
    email.trim().toLowerCase() !== "bozo.nad123@gmail.com"
  ) {
    return state;
  }

  const targetIndex = state.players.findIndex(
    (player) => player.socketId === socketId,
  );

  if (targetIndex < 0) {
    return state;
  }

  const targetSocketId = state.players[targetIndex].socketId;
  const players = state.players.map((player) => ({
    ...player,
    hand: [...player.hand],
  }));
  const belaCards: Card[] = [
    { suit: "hearts", rank: "K" },
    { suit: "hearts", rank: "Q" },
  ];

  for (const belaCard of belaCards) {
    const target = players.find((player) => player.socketId === targetSocketId);
    const holder = players.find((player) =>
      player.hand.some(
        (card) => card.suit === belaCard.suit && card.rank === belaCard.rank,
      ),
    );

    if (!target || !holder || holder.socketId === targetSocketId) {
      continue;
    }

    const targetCardIndex = target.hand.findIndex(
      (card) =>
        !(card.suit === "hearts" && (card.rank === "K" || card.rank === "Q")),
    );
    const holderCardIndex = holder.hand.findIndex(
      (card) => card.suit === belaCard.suit && card.rank === belaCard.rank,
    );

    if (targetCardIndex < 0 || holderCardIndex < 0) {
      continue;
    }

    const exchangedCard = target.hand[targetCardIndex];
    target.hand[targetCardIndex] = belaCard;
    holder.hand[holderCardIndex] = exchangedCard;
  }

  return {
    ...state,
    players,
    declarationHands: players.map((player) => [...player.hand]),
  };
}
app.get("/", async () => {
  return {
    message: "Belot server radi!",
  };
});

// Javni dohvat slobodnih soba - prijava nije potrebna.
app.get("/rooms/public", async () => {
  return {
    success: true,
    rooms: roomManager.listPublicRooms(),
  };
});
app.get("/health", async () => {
  await db.execute(sql`SELECT 1`);

  return {
    server: "online",
    database: "connected",
  };
});

// Kreiranje i pridruživanje sobama
io.on("connection", (socket) => {
  console.log("Igrač spojen:", socket.id);

  socket.on("get_available_players", (callback) => {
    callback?.({
      success: true,
      players: getAvailablePlayers(),
    });
  });

  // Ponovna provjera sesije prije obrade svakog događaja
  const sessionToken = socket.handshake.auth?.token;

  socket.use((packet, next) => {
    void (async () => {
      try {
        if (typeof sessionToken !== "string") {
          socket.disconnect(true);
          next(new Error("Nedostaje korisnička sesija."));
          return;
        }

        const currentUser = await getSessionUser(sessionToken);

        if (!currentUser) {
          // Prekidamo vezu ako je sesija istekla ili je opozvana odjavom.
          socket.disconnect(true);
          next(new Error("Sesija je istekla ili je korisnik odjavljen."));
          return;
        }

        next();
      } catch {
        // U slučaju greške pri provjeri ne dopuštamo obradu događaja.
        socket.disconnect(true);
        next(new Error("Provjera korisničke sesije nije uspjela."));
      }
    })();
  });

  const authenticatedUser = socket.data.user as AuthenticatedUser;

  if (!authenticatedUser) {
    socket.disconnect(true);
    return;
  }

  // Rejting se dohvaca iz baze, ne od klijenta.
  void db.select({ rating: users.rating }).from(users)
    .where(eq(users.id, authenticatedUser.userId)).limit(1)
    .then(([row]) => {
      if (!socket.connected) return;
      socket.data.rating = row?.rating ?? 0;
      broadcastAvailablePlayers();
    })
    .catch((error) => console.error("Dohvat rejtinga aktivnog igraca nije uspio:", error));
  broadcastAvailablePlayers();

  const userId = authenticatedUser.userId;
  const username = authenticatedUser.username;

  // Ponovna provjera sesije prije obrade svakog događaja
  socket.use((packet, next) => {
    const token = socket.handshake.auth?.token;

    if (typeof token !== "string") {
      socket.disconnect(true);
      return next(new Error("Sesija nije valjana."));
    }

    void getSessionUser(token)
      .then((currentUser) => {
        if (
          !currentUser ||
          currentUser.userId !== authenticatedUser.userId ||
          currentUser.accountId !== authenticatedUser.accountId
        ) {
          socket.disconnect(true);
          return next(new Error("Sesija je istekla ili je opozvana."));
        }

        next();
      })
      .catch(() => {
        socket.disconnect(true);
        next(new Error("Provjera sesije nije uspjela."));
      });
  });

  // Pozivnice smije slati samo domacin aktivne cekaonice.
  socket.on("invite_room_player", (data: { targetUserId?: number }, callback) => {
    try {
      const room = roomManager.getPlayerRoom(socket.id);
      if (!room || room.status !== "waiting") throw new Error("Soba nije dostupna.");
      const sender = room.players.find((player) => player.id === socket.id);
      if (!sender?.isHost) throw new Error("Samo admin moze pozivati igrace.");
      if (room.players.length >= room.maxPlayers) throw new Error("Soba je puna.");
      if (!Number.isInteger(data?.targetUserId) || data.targetUserId === sender.userId) throw new Error("Neispravan igrac.");
      const target = [...io.sockets.sockets.values()].find((item) => {
        const user = item.data.user as AuthenticatedUser | undefined;
        return user?.userId === data.targetUserId && !roomManager.getUserRoom(user.userId);
      });
      if (!target) throw new Error("Igrac vise nije slobodan.");
      const inviteKey = `${room.code}:${data.targetUserId}`;
      if (pendingInvites.has(inviteKey)) throw new Error("Pozivnica je već poslana.");
      const timer = setTimeout(() => {
        const pending = pendingInvites.get(inviteKey);
        if (!pending) return;
        pendingInvites.delete(inviteKey);
        io.to(pending.senderSocketId).emit("room_invite_status", { targetUserId: pending.targetUserId, status: "expired" });
      }, 60000);
      pendingInvites.set(inviteKey, { senderSocketId: socket.id, targetUserId: data.targetUserId as number, timer });
      target.emit("room_invite", { roomCode: room.code, hostName: sender.username });
      callback?.({ success: true });
    } catch (error) {
      callback?.({ success: false, message: error instanceof Error ? error.message : "Poziv nije poslan." });
    }
  });

  // Odgovor primatelja otključava gumb Pozovi kod admina.
  socket.on("respond_room_invite", (data: { roomCode?: string; accepted?: boolean }, callback) => {
    const user = socket.data.user as AuthenticatedUser | undefined;
    const inviteKey = `${data?.roomCode}:${user?.userId}`;
    const pending = pendingInvites.get(inviteKey);
    if (!user || !pending) {
      callback?.({ success: false, message: "Pozivnica više nije aktivna." });
      return;
    }
    clearTimeout(pending.timer);
    pendingInvites.delete(inviteKey);
    io.to(pending.senderSocketId).emit("room_invite_status", {
      targetUserId: user.userId,
      status: data.accepted ? "accepted" : "declined",
    });
    callback?.({ success: true });
  });

  // KREIRANJE SOBE
  socket.on(
    "create_room",
    async (
      data: {
        isPublic?: unknown;
        minRating?: unknown;
        turnDuration?: unknown;
        gameType?: unknown;
        targetScore?: unknown;
      },
      callback,
    ) => {
      let room: Room | undefined;

      try {
        // Provjera primljenih podataka.
        if (!data || typeof data !== "object") {
          throw new Error("Neispravni podaci za stvaranje sobe.");
        }

        if (data.isPublic !== undefined && typeof data.isPublic !== "boolean") {
          throw new Error("Neispravna postavka privatnosti sobe.");
        }

        if (
          data.minRating !== undefined &&
          (!Number.isInteger(data.minRating) ||
            (data.minRating as number) < 0 ||
            (data.minRating as number) > 10)
        ) {
          throw new Error(
            "Minimalni rejting mora biti cijeli broj od 0 do 10.",
          );
        }

        if (data.turnDuration !== undefined && ![15, 30, 45].includes(data.turnDuration as number)) {
          throw new Error("Trajanje poteza mora biti 15, 30 ili 45 sekundi.");
        }
        if (data.gameType !== undefined && !["prolaz", "dosta"].includes(data.gameType as string)) {
          throw new Error("Nepoznat tip igre.");
        }
        if (data.targetScore !== undefined && ![501, 701, 1001].includes(data.targetScore as number)) {
          throw new Error("Igra se do 501, 701 ili 1001 bod.");
        }

        // Identitet i nadimak dolaze isključivo iz prijavljene sesije.
        const userId = authenticatedUser.userId;
        const username = authenticatedUser.username;

        await cleanupDisconnectedRoomMembership(userId);

        const isPublic = data.isPublic ?? true;
        const minRating = (data.minRating as number | undefined) ?? 0;

        // Rejting se uvijek dohvaća iz baze.
        const [user] = await db
          .select({ rating: users.rating })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          throw new Error("Korisnik nije pronađen u bazi.");
        }

        const createdRoom = roomManager.createRoom(
          socket.id,
          userId,
          username,
          isPublic,
          minRating,
          user.rating,
          (data.turnDuration as 15 | 30 | 45 | undefined) ?? 30,
          (data.gameType as "prolaz" | "dosta" | undefined) ?? "prolaz",
          (data.targetScore as 501 | 701 | 1001 | undefined) ?? 1001,
        );

        room = createdRoom;

        await db.transaction(async (tx) => {
          const [game] = await tx
            .insert(games)
            .values({
              roomCode: createdRoom.code,
              status: "waiting",
              maxPlayers: 4,
              isPublic: createdRoom.isPublic,
              minRating: createdRoom.minRating,
            })
            .returning({ id: games.id });

          if (!game) {
            throw new Error("Soba nije spremljena u bazu.");
          }

          await tx.insert(gamePlayers).values({
            gameId: game.id,
            userId,
            seat: 1,
            isHost: true,
          });
        });

        socketUsers.set(socket.id, userId);
        socket.join(createdRoom.code);

        const roomHistory = await fetchRoomChatHistory(createdRoom.code);
        socket.emit("room_chat_history", roomHistory);

        callback?.({
          success: true,
          room: createdRoom,
        });

        io.to(createdRoom.code).emit("room_updated", createdRoom);
        io.emit("public_rooms_updated", roomManager.listPublicRooms());
      } catch (error) {
        if (room) {
          roomManager.leaveRoom(socket.id);
        }

        callback?.({
          success: false,
          message: error instanceof Error ? error.message : "Greška.",
        });
      }

      broadcastAvailablePlayers();
    },
  );

  // PRIDRUŽIVANJE SOBI
  socket.on(
    "join_room",
    async (
      data: {
        roomCode?: unknown;
      },
      callback,
    ) => {
      let room: Room | undefined;
      let lockedRoomCode: string | null = null;

      try {
        // Provjera primljenih podataka.
        if (!data || typeof data !== "object") {
          throw new Error("Neispravni podaci za pridruživanje sobi.");
        }

        if (
          typeof data.roomCode !== "string" ||
          !/^\d{4}$/.test(data.roomCode.trim().toUpperCase())
        ) {
          throw new Error("Šifra sobe mora imati točno 4 znamenke.");
        }

        const userId = authenticatedUser.userId;
        const cleanRoomCode = data.roomCode.trim().toUpperCase();

        await cleanupDisconnectedRoomMembership(userId);

        // Rejting se uvijek dohvaća iz baze.
        const [user] = await db
          .select({ rating: users.rating })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          throw new Error("Korisnik nije pronađen u bazi.");
        }

        if (typeof data?.roomCode !== "string") {
          throw new Error("Neispravan kod sobe.");
        }

        const targetRoom = roomManager.getRoom(cleanRoomCode);

        if (!targetRoom) {
          throw new Error("Soba nije pronađena.");
        }

        if (pendingRoomOperations.has(targetRoom.code)) {
          throw new Error(
            "Promjena igrača u sobi je u tijeku. Pokušaj ponovno.",
          );
        }
        pendingRoomOperations.add(targetRoom.code);
        lockedRoomCode = targetRoom.code;

        const joinedRoom = roomManager.joinRoom(
          socket.id,
          userId,
          username,
          cleanRoomCode,
          user.rating,
        );

        room = joinedRoom;

        const player = joinedRoom.players.find((item) => item.id === socket.id);

        if (!player) {
          throw new Error("Igrač nije pronađen u sobi.");
        }

        await db.transaction(async (tx) => {
          const [game] = await tx
            .select({
              id: games.id,
              status: games.status,
            })
            .from(games)
            .where(eq(games.roomCode, joinedRoom.code))
            .limit(1);

          if (!game || game.status !== "waiting") {
            throw new Error("Soba više nije dostupna.");
          }

          await tx.insert(gamePlayers).values({
            gameId: game.id,
            userId,
            seat: player.seat,
            isHost: false,
          });
        });

        socketUsers.set(socket.id, userId);
        socket.join(joinedRoom.code);

        const roomHistory = await fetchRoomChatHistory(joinedRoom.code);
        socket.emit("room_chat_history", roomHistory);

        io.to(joinedRoom.code).emit("room_updated", joinedRoom);
        io.emit("public_rooms_updated", roomManager.listPublicRooms());

        callback?.({
          success: true,
          room: joinedRoom,
        });
      } catch (error) {
        if (room) {
          roomManager.leaveRoom(socket.id);
        }

        callback?.({
          success: false,
          message: error instanceof Error ? error.message : "Greška.",
        });
      } finally {
        if (lockedRoomCode !== null) {
          pendingRoomOperations.delete(lockedRoomCode);
        }

        broadcastAvailablePlayers();
      }
    },
  );

  socket.on(
    "swap_players",
    async (data: { firstSeat?: unknown; secondSeat?: unknown }, callback) => {
      try {
        if (
          !data ||
          !Number.isInteger(data.firstSeat) ||
          !Number.isInteger(data.secondSeat)
        ) {
          throw new Error("Neispravna mjesta igrača.");
        }

        const firstSeat = data.firstSeat as number;
        const secondSeat = data.secondSeat as number;

        const room = roomManager.getPlayerRoom(socket.id);

        if (!room || room.status !== "waiting") {
          throw new Error("Soba nije dostupna.");
        }
        if (pendingRoomOperations.has(room.code)) {
          throw new Error("Promjena u sobi već je u tijeku.");
        }

        pendingRoomOperations.add(room.code);

        try {
          const updatedRoom = roomManager.swapPlayers(
            socket.id,
            firstSeat,
            secondSeat,
          );

          try {
            await db.transaction(async (tx) => {
              const [game] = await tx
                .select({ id: games.id })
                .from(games)
                .where(eq(games.roomCode, room.code))
                .limit(1);

              if (!game) {
                throw new Error("Partija nije pronađena.");
              }

              // Privremene vrijednosti izbjegavaju konflikt
              // ako baza ima UNIQUE(gameId, seat).
              for (let i = 0; i < updatedRoom.players.length; i++) {
                const player = updatedRoom.players[i];

                await tx
                  .update(gamePlayers)
                  .set({ seat: i + 101 })
                  .where(
                    and(
                      eq(gamePlayers.gameId, game.id),
                      eq(gamePlayers.userId, player.userId),
                    ),
                  );
              }

              for (let i = 0; i < updatedRoom.players.length; i++) {
                const player = updatedRoom.players[i];

                await tx
                  .update(gamePlayers)
                  .set({ seat: player.seat })
                  .where(
                    and(
                      eq(gamePlayers.gameId, game.id),
                      eq(gamePlayers.userId, player.userId),
                    ),
                  );
              }
            });
          } catch (error) {
            // Vrati redoslijed u memoriji ako spremanje nije uspjelo.
            roomManager.swapPlayers(socket.id, firstSeat, secondSeat);
            throw error;
          }

          io.to(room.code).emit("room_updated", updatedRoom);

          callback?.({ success: true });
        } finally {
          pendingRoomOperations.delete(room.code);
        }
      } catch (error) {
        callback?.({
          success: false,
          message: error instanceof Error ? error.message : "Greška.",
        });
      }
    },
  );

  socket.on(
    "kick_player",
    async (data: { playerSocketId?: unknown }, callback) => {
      try {
        const room = roomManager.getPlayerRoom(socket.id);

        if (!room || room.status !== "waiting") {
          throw new Error("Igrača možeš ukloniti samo iz čekaonice.");
        }

        if (pendingRoomOperations.has(room.code)) {
          throw new Error("Promjena igrača u sobi već je u tijeku.");
        }

        pendingRoomOperations.add(room.code);

        try {
          const host = room.players.find((player) => player.id === socket.id);

          if (!host?.isHost) {
            throw new Error("Samo domaćin može ukloniti igrača.");
          }

          if (
            !data ||
            typeof data.playerSocketId !== "string" ||
            data.playerSocketId === socket.id
          ) {
            throw new Error("Odabrani igrač nije valjan.");
          }

          const target = room.players.find(
            (player) => player.id === data.playerSocketId,
          );

          if (!target || target.isHost) {
            throw new Error("Igrača nije moguće ukloniti iz sobe.");
          }

          const [game] = await db
            .select({ id: games.id, status: games.status })
            .from(games)
            .where(eq(games.roomCode, room.code))
            .limit(1);

          if (!game || game.status !== "waiting") {
            throw new Error("Igrača možeš ukloniti samo iz čekaonice.");
          }

          const remainingPlayers = room.players.filter(
            (player) => player.id !== target.id,
          );

          await db.transaction(async (tx) => {
            await tx
              .delete(gamePlayers)
              .where(
                and(
                  eq(gamePlayers.gameId, game.id),
                  eq(gamePlayers.userId, target.userId),
                ),
              );
          });

          const updatedRoom = roomManager.leaveRoom(target.id);

          if (!updatedRoom) {
            throw new Error("Soba više nije dostupna.");
          }

          socketUsers.delete(target.id);
          const targetSocket = io.sockets.sockets.get(target.id);
          targetSocket?.emit("player_kicked", {
            message: `Domaćin te uklonio iz sobe ${room.code}.`,
          });
          targetSocket?.leave(room.code);

          io.to(room.code).emit("room_updated", updatedRoom);
          io.emit("public_rooms_updated", roomManager.listPublicRooms());
          broadcastAvailablePlayers();

          callback?.({ success: true });
        } finally {
          pendingRoomOperations.delete(room.code);
        }
      } catch (error) {
        callback?.({
          success: false,
          message: error instanceof Error ? error.message : "Greška.",
        });
      }
    },
  );

  // POMOĆNA FUNKCIJA: slanje privatnog prikaza partije svakom igraču.
  function broadcastGameState(state: GameState) {
    for (const player of state.players) {
      io.to(player.socketId).emit(
        "game_state",
        getPlayerGameView(state, player.socketId),
      );
    }
  }

  socket.on("room_chat_send", async (data: { message?: unknown }, callback) => {
    try {
      const room = roomManager.getPlayerRoom(socket.id);

      if (!room) {
        throw new Error("Nisi u sobi.");
      }

      if (
        !data ||
        typeof data !== "object" ||
        typeof data.message !== "string"
      ) {
        throw new Error("Poruka nije ispravnog formata.");
      }

      const message = data.message.trim();

      if (!message) {
        throw new Error("Poruka ne smije biti prazna.");
      }

      if (message.length > 300) {
        throw new Error("Poruka je predugačka.");
      }

      const [savedMessage] = await db
        .insert(roomMessages)
        .values({
          roomCode: room.code,
          userId: authenticatedUser.userId,
          username: authenticatedUser.username,
          message,
        })
        .returning({
          id: roomMessages.id,
          roomCode: roomMessages.roomCode,
          userId: roomMessages.userId,
          username: roomMessages.username,
          message: roomMessages.message,
          createdAt: roomMessages.createdAt,
        });

      if (!savedMessage) {
        throw new Error("Poruka nije spremljena.");
      }

      io.to(room.code).emit("room_chat_message", {
        ...savedMessage,
        createdAt: savedMessage.createdAt ?? new Date(),
      });

      callback?.({
        success: true,
        message: savedMessage,
      });
    } catch (error) {
      callback?.({
        success: false,
        message: error instanceof Error ? error.message : "Greška.",
      });
    }
  });

  // BIRANJE ADUTA
  socket.on("choose_trump", (data: { trumpSuit: Suit }, callback) => {
    try {
      const room = roomManager.getPlayerRoom(socket.id);

      if (!room) {
        throw new Error("Nisi u sobi.");
      }

      const gameState = activeGames.get(room.code);

      if (!gameState) {
        throw new Error("Partija nije pronađena.");
      }

      const player = gameState.players.find(
        (item) => item.socketId === socket.id,
      );

      if (!player) {
        throw new Error("Nisi dio ove partije.");
      }

      const updatedState = chooseTrump(
        gameState,
        player.playerNumber,
        data.trumpSuit,
      );

      activeGames.set(room.code, updatedState);

      broadcastGameState(updatedState);

      callback?.({
        success: true,
      });
    } catch (error) {
      callback?.({
        success: false,
        message: error instanceof Error ? error.message : "Greška.",
      });
    }
  });

  socket.on(
    "submit_declarations",
    async (data: { cards?: unknown }, callback) => {
      let revealRoomCode: string | null = null;

      try {
        const room = roomManager.getPlayerRoom(socket.id);

        if (!room) {
          throw new Error("Nisi u sobi.");
        }

        const gameState = activeGames.get(room.code);

        if (!gameState) {
          throw new Error("Partija nije pronađena.");
        }

        if (pendingDeclarationReveals.has(room.code)) {
          throw new Error("Pričekaj da se zvanje prikaže svim igračima.");
        }

        const player = gameState.players.find(
          (item) => item.socketId === socket.id,
        );

        if (!player) {
          throw new Error("Nisi dio ove partije.");
        }

        if (!data || (data.cards !== undefined && !Array.isArray(data.cards))) {
          throw new Error("Odabrane karte nisu ispravnog formata.");
        }

        const selectedCards = (data.cards ?? []) as Card[];

        console.log("ZAPRIMLJENO ZVANJE:", {
          phase: gameState.phase,
          roundNumber: gameState.roundNumber,
          playerNumber: player.playerNumber,
          declarationTurnPlayerNumber: gameState.declarationTurnPlayerNumber,
          completedDeclarationPlayers: gameState.completedDeclarationPlayers,
          selectedCards,
        });

        const updatedState = submitDeclarations(
          gameState,
          player.playerNumber,
          selectedCards,
        );

        activeGames.set(room.code, updatedState);
        broadcastGameState(updatedState);

        if (updatedState.activeDeclarations.length > 0) {
          revealRoomCode = room.code;
          pendingDeclarationReveals.add(room.code);

          await new Promise((resolve) => setTimeout(resolve, 2000));

          if (activeGames.get(room.code) !== updatedState) {
            throw new Error("Partija je prekinuta tijekom prikaza zvanja.");
          }

          const clearedRevealState: GameState = {
            ...updatedState,
            activeDeclarations: [],
          };

          activeGames.set(room.code, clearedRevealState);
          broadcastGameState(clearedRevealState);
        }

        callback?.({
          success: true,
          accepted: selectedCards.length > 0,
          complete: updatedState.phase === "playing",
        });
      } catch (error) {
        callback?.({
          success: false,
          message: error instanceof Error ? error.message : "Greška.",
        });
      } finally {
        if (revealRoomCode) {
          pendingDeclarationReveals.delete(revealRoomCode);
        }
      }
    },
  );

  // PROLAZ PRI BIRANJU ADUTA
  socket.on("pass_trump", (callback) => {
    try {
      const room = roomManager.getPlayerRoom(socket.id);

      if (!room) {
        throw new Error("Nisi u sobi.");
      }

      const gameState = activeGames.get(room.code);

      if (!gameState) {
        throw new Error("Partija nije pronađena.");
      }

      const player = gameState.players.find(
        (item) => item.socketId === socket.id,
      );

      if (!player) {
        throw new Error("Nisi dio ove partije.");
      }

      if (gameState.trumpTurnPlayerNumber !== player.playerNumber) {
        throw new Error("Nisi ti na redu za biranje aduta.");
      }

      const updatedState = passTrump(gameState);

      activeGames.set(room.code, updatedState);

      broadcastGameState(updatedState);

      callback?.({
        success: true,
      });
    } catch (error) {
      callback?.({
        success: false,
        message: error instanceof Error ? error.message : "Greška.",
      });
    }
  });

  // TODO OBRISATI
  socket.on("test_next_deal", () => {
    try {
      const room = roomManager.getPlayerRoom(socket.id);

      if (!room) {
        throw new Error("Nisi u sobi.");
      }

      const gameState = activeGames.get(room.code);

      if (!gameState) {
        throw new Error("Partija nije pronađena.");
      }

      const nextState = createNextDeal({
        ...gameState,
        phase: "round_finished",
      });

      activeGames.set(room.code, nextState);
      broadcastGameState(nextState);
    } catch (error) {
      console.error("Greška testnog dijeljenja:", error);
    }
  });

  // IGRANJE KARTE
  // Provjera prije pitanja za belu; pravila ostaju na serveru.
  socket.on("validate_card", (data: { card: Card }, callback) => {
    try {
      const room = roomManager.getPlayerRoom(socket.id);
      if (!room) throw new Error("Nisi u sobi.");
      const state = activeGames.get(room.code);
      if (!state || state.phase !== "playing") throw new Error("Trenutno nije moguce odigrati kartu.");
      if (pendingTrickResolutions.has(room.code) || pendingDeclarationReveals.has(room.code)) {
        throw new Error("Pricekaj da se zavrsi prikaz stiha.");
      }
      const player = state.players.find((item) => item.socketId === socket.id);
      if (!player || player.playerNumber !== state.currentPlayerNumber) {
        throw new Error("Nisi na potezu.");
      }
      const legal = getLegalCards(
        player.hand,
        state.currentTrick[0]?.card.suit ?? null,
        state.trumpSuit!,
        state.currentTrick,
      );
      if (!legal.some((card) => card.suit === data.card?.suit && card.rank === data.card?.rank)) {
        throw new Error("Ta karta nije dozvoljena.");
      }
      callback({ success: true });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Kartu nije moguce odigrati." });
    }
  });

  socket.on(
    "play_card",
    async (
      data: {
        card: Card;
        announceBela?: boolean;
      },
      callback,
    ) => {
      let lockedRoomCode: string | null = null;
      let previousGameState: GameState | null = null;
      let visibleTrickState: GameState | null = null;

      try {
        const room = roomManager.getPlayerRoom(socket.id);

        if (!room) {
          throw new Error("Nisi u sobi.");
        }

        const gameState = activeGames.get(room.code);

        if (!gameState) {
          throw new Error("Partija nije pronađena.");
        }

        if (
          pendingTrickResolutions.has(room.code) ||
          pendingDeclarationReveals.has(room.code)
        ) {
          throw new Error("Pričekaj da se završi prikaz štiha.");
        }

        previousGameState = gameState;

        const player = gameState.players.find(
          (item) => item.socketId === socket.id,
        );

        if (!player) {
          throw new Error("Nisi dio ove partije.");
        }

        // Izračunavanje poteza na serveru.
        const updatedState = playCard(
          gameState,
          player.playerNumber,
          data.card,
          data.announceBela ?? false,
        );

        if (
          gameState.currentTrick.length === 3 &&
          updatedState.currentTrick.length === 0
        ) {
          pendingTrickResolutions.add(room.code);
          lockedRoomCode = room.code;

          const revealedPlayers = gameState.players.map((gamePlayer) =>
            gamePlayer.playerNumber === player.playerNumber
              ? {
                  ...gamePlayer,
                  hand: gamePlayer.hand.filter(
                    (card) =>
                      card.suit !== data.card.suit ||
                      card.rank !== data.card.rank,
                  ),
                }
              : gamePlayer,
          );
          const revealState: GameState = {
            ...gameState,
            players: revealedPlayers,
            currentTrick: [
              ...gameState.currentTrick,
              { playerNumber: player.playerNumber, card: data.card },
            ],
            currentPlayerNumber: 0,
          };

          visibleTrickState = revealState;
          activeGames.set(room.code, revealState);
          broadcastGameState(revealState);

          // Kratko pokazujemo cijeli stih, zatim svi klijenti istodobno
          // animiraju cetiri karte prema pobjedniku.
          await new Promise((resolve) => setTimeout(resolve, 1000));

          if (activeGames.get(room.code) !== revealState) {
            throw new Error("Partija je prekinuta tijekom prikaza stiha.");
          }

          const winningCard = getTrickWinner(
            revealState.currentTrick,
            revealState.trumpSuit!,
          );
          for (const gamePlayer of revealState.players) {
            io.to(gamePlayer.socketId).emit("trick_collect", {
              winnerPlayerNumber: winningCard.playerNumber,
            });
          }

          await new Promise((resolve) => setTimeout(resolve, 950));

          if (activeGames.get(room.code) !== revealState) {
            throw new Error("Partija je prekinuta tijekom prikaza štiha.");
          }
        }

        // Spremamo kumulativni rezultat nakon svakog završenog dijeljenja.
        if (
          updatedState.phase === "round_finished" ||
          updatedState.phase === "finished"
        ) {
          // Kod DOSTA partija moze zavrsiti usred dijeljenja bez finalScore.
          if (updatedState.callingTeam === null ||
              (updatedState.phase === "round_finished" && !updatedState.finalScore)) {
            throw new Error("Konačni rezultat nije ispravno izračunat.");
          }

          if (updatedState.phase === "finished") {
            if (updatedState.matchWinnerTeam === null) {
              throw new Error("Zavrseni mec nema pobjednika.");
            }

            // Jedna transakcija sprema rezultat i azurira statistiku sva cetiri igraca.
            await finishMatchWithStats({
              roomCode: room.code,
              winnerTeam: updatedState.matchWinnerTeam,
              team1Score: updatedState.team1MatchScore,
              team2Score: updatedState.team2MatchScore,
              callingTeam: updatedState.callingTeam,
              contractMade: updatedState.finalScore?.contractMade ?? null,
              declarationPoints: updatedState.finalScore?.declarationPoints ??
                (updatedState.team1DeclaredPoints + updatedState.team2DeclaredPoints),
              team1Bela: updatedState.finalScore?.team1Bela ?? updatedState.team1Bela,
              team2Bela: updatedState.finalScore?.team2Bela ?? updatedState.team2Bela,
            });
          } else {
            const [savedGame] = await db
              .update(games)
              .set({
                status:
                  updatedState.phase === "finished" ? "finished" : "playing",
                finishedAt: updatedState.phase === "finished" ? new Date() : null,
                team1Score: updatedState.team1MatchScore,
                team2Score: updatedState.team2MatchScore,
                callingTeam: updatedState.callingTeam,
                contractMade: updatedState.finalScore?.contractMade ?? null,
                declarationPoints: updatedState.finalScore?.declarationPoints ?? (updatedState.team1DeclaredPoints + updatedState.team2DeclaredPoints),
                team1Bela: updatedState.finalScore?.team1Bela ?? updatedState.team1Bela,
                team2Bela: updatedState.finalScore?.team2Bela ?? updatedState.team2Bela,
              })
              .where(
                and(eq(games.roomCode, room.code), eq(games.status, "playing")),
              )
              .returning({ id: games.id });
  
            if (!savedGame) {
              throw new Error(
                "Rezultat nije spremljen. Partija nije pronađena ili je već završena.",
              );
            }
          }

          console.log("Konačni rezultat spremljen u bazu:", {
            roomCode: room.code,
            round: updatedState.roundNumber,
            team1: updatedState.team1MatchScore,
            team2: updatedState.team2MatchScore,
            matchFinished: updatedState.phase === "finished",
          });
        }

        // Ažuriranje stanja partije u memoriji servera.
        activeGames.set(room.code, updatedState);

        // Svaki igrač dobiva vlastiti prikaz partije.
        broadcastGameState(updatedState);

        if (updatedState.phase === "finished" && updatedState.matchWinnerTeam !== null) {
          // Mec je gotov: svim igracima saljemo pobjednika i vracamo ih u lobby.
          const winner = updatedState.matchWinnerTeam;
          io.to(room.code).emit("match_finished", {
            winnerTeam: winner,
            team1Score: updatedState.team1MatchScore,
            team2Score: updatedState.team2MatchScore,
          });
          activeGames.delete(room.code);
          const closedRoom = roomManager.closeRoom(room.code);
          if (closedRoom) {
            for (const member of closedRoom.players) {
              io.sockets.sockets.get(member.id)?.leave(room.code);
            }
          }
          io.emit("public_rooms_updated", roomManager.listPublicRooms());
          broadcastAvailablePlayers();
        }

        if (updatedState.phase === "round_finished") {
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Provjera da se stanje u međuvremenu nije promijenilo.
          if (activeGames.get(room.code) === updatedState) {
            const nextState = createNextDeal(updatedState);

            activeGames.set(room.code, nextState);
            broadcastGameState(nextState);
          }
        }

        callback?.({
          success: true,
        });
      } catch (error) {
        if (
          lockedRoomCode &&
          previousGameState &&
          visibleTrickState &&
          activeGames.get(lockedRoomCode) === visibleTrickState
        ) {
          activeGames.set(lockedRoomCode, previousGameState);
          broadcastGameState(previousGameState);
        }

        callback?.({
          success: false,
          message: error instanceof Error ? error.message : "Greška.",
        });
      } finally {
        if (lockedRoomCode) {
          pendingTrickResolutions.delete(lockedRoomCode);
        }
      }
    },
  );

  /* socket.on("start_next_deal", (callback) => {
    try {
      const room = roomManager.getPlayerRoom(socket.id);

      if (!room) {
        throw new Error("Nisi u sobi.");
      }

      const host = room.players.find((player) => player.id === socket.id);

      if (!host?.isHost) {
        throw new Error("Samo domaćin može pokrenuti novo dijeljenje.");
      }

      const gameState = activeGames.get(room.code);

      if (!gameState) {
        throw new Error("Partija nije pronađena.");
      }

      const nextState = createNextDeal(gameState);
      activeGames.set(room.code, nextState);
      broadcastGameState(nextState);

      callback?.({ success: true });
    } catch (error) {
      callback?.({
        success: false,
        message: error instanceof Error ? error.message : "Greška.",
      });
    }
  }); */

  // NAPUŠTANJE SOBE
  socket.on("leave_room", async (callback) => {
    const success = await removePlayerFromRoom(socket);

    callback?.({
      success,
      message: success ? undefined : "Nisi u sobi.",
    });
    broadcastAvailablePlayers();
  });
  // PREKID VEZE
  socket.on("disconnect", async () => {
    console.log("Igrač odspojen:", socket.id);
    await removePlayerFromRoom(socket);
    broadcastAvailablePlayers();
  });
  // DOHVAT JAVNIH SOBA
  socket.on("get_public_rooms", (callback) => {
    const publicRooms = roomManager.listPublicRooms();

    callback?.({
      success: true,
      rooms: publicRooms,
    });
  });

  // POKRETANJE PARTIJE
  socket.on("start_game", async (callback) => {
    let lockedRoomCode: string | null = null;
    try {
      const existingRoom = roomManager.getPlayerRoom(socket.id);

      if (!existingRoom) {
        throw new Error("Nisi u sobi.");
      }

      if (activeGames.has(existingRoom.code)) {
        throw new Error("Partija je već pokrenuta.");
      }

      if (pendingRoomOperations.has(existingRoom.code)) {
        throw new Error("Pričekaj završetak promjene mjesta igrača.");
      }

      pendingRoomOperations.add(existingRoom.code);
      lockedRoomCode = existingRoom.code;
      // Provjera domaćina i četiri igrača.
      const room = roomManager.startGame(socket.id);

      // Stvaranje partije i dijeljenje početnih 6 karata.
      const gameState = createGameState(
        room.code,
        room.players.map((player) => ({
          socketId: player.id,
          username: player.username,
        })),
        1,
        { matchSettings: { gameType: room.gameType, targetScore: room.targetScore, turnDuration: room.turnDuration } },
      );
      const seededGameState = seedBelaTestHand(
        gameState,
        authenticatedUser.email,
        socket.id,
      );

      // Ažuriranje statusa sobe u bazi.
      const [updatedGame] = await db
        .update(games)
        .set({
          status: "playing",
          finishedAt: null,
          team1Score: 0,
          team2Score: 0,
          callingTeam: null,
          contractMade: null,
          declarationPoints: 0,
          team1Bela: 0,
          team2Bela: 0,
        })
        .where(eq(games.roomCode, room.code))
        .returning({ id: games.id });

      if (!updatedGame) {
        throw new Error("Partija nije pronađena u bazi.");
      }

      // Spremanje aktivne partije u memoriju servera.
      activeGames.set(room.code, seededGameState);

      // Svaki igrač dobiva vlastiti prikaz partije.
      for (const player of room.players) {
        io.to(player.id).emit(
          "game_started",
          getPlayerGameView(seededGameState, player.id),
        );
      }

      // Obavještavanje sobe o promjeni statusa.
      io.to(room.code).emit("room_updated", room);

      // Uklanjanje sobe iz javnog popisa.
      io.emit("public_rooms_updated", roomManager.listPublicRooms());

      callback?.({
        success: true,
        room,
      });
    } catch (error) {
      callback?.({
        success: false,
        message: error instanceof Error ? error.message : "Greška.",
      });
    } finally {
      if (lockedRoomCode !== null) {
        pendingRoomOperations.delete(lockedRoomCode);
      }
    }
  });
});

async function removePlayerFromRoom(socket: Socket): Promise<boolean> {
  return removeRoomMember(socket.id, socket);
}

async function cleanupDisconnectedRoomMembership(
  userId: number,
): Promise<void> {
  const room = roomManager.getUserRoom(userId);
  const player = room?.players.find((item) => item.userId === userId);

  if (!player || io.sockets.sockets.get(player.id)?.connected) {
    return;
  }

  await removeRoomMember(player.id);
}

async function removeRoomMember(
  socketId: string,
  socket?: Socket,
): Promise<boolean> {
  const initialRoom = roomManager.getPlayerRoom(socketId);

  if (!initialRoom) {
    return false;
  }

  const roomCode = initialRoom.code;

  // Pričekaj završetak druge operacije nad sobom.
  while (pendingRoomOperations.has(roomCode)) {
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }

  // Ponovno provjeri je li igrač još uvijek u sobi.
  const room = roomManager.getPlayerRoom(socketId);

  if (!room || room.code !== roomCode) {
    return false;
  }

  pendingRoomOperations.add(roomCode);

  try {
    const userId = socketUsers.get(socketId);
    const departingPlayer = room.players.find(
      (player) => player.id === socketId,
    );
    const gameState = activeGames.get(roomCode);
    const gameWasInProgress =
      gameState !== undefined && gameState.phase !== "finished";

    // Odlazak domaćina raspušta cijelu sobu, bez dodjele novog domaćina.
    if (departingPlayer?.isHost) {
      const closeMessage = "Admin sobe je napustio sobu.";
      const members = [...room.players];
      const closedRoom = roomManager.closeRoom(roomCode);
      if (!closedRoom) return false;

      activeGames.delete(roomCode);
      socketUsers.delete(socketId);
      for (const member of members) {
        const memberSocket = io.sockets.sockets.get(member.id);
        if (member.id !== socketId) {
          memberSocket?.emit("room_closed", { message: closeMessage });
        }
        memberSocket?.leave(roomCode);
      }

      try {
        const [game] = await db.select({ id: games.id, status: games.status })
          .from(games).where(eq(games.roomCode, roomCode)).limit(1);
        if (game && game.status !== "finished") {
          await db.transaction(async (tx) => {
            await tx.delete(gamePlayers).where(eq(gamePlayers.gameId, game.id));
            await tx.delete(games).where(eq(games.id, game.id));
          });
        }
      } catch (error) {
        console.error("Greska pri brisanju raspustene sobe iz baze:", error);
      }

      io.emit("public_rooms_updated", roomManager.listPublicRooms());
      return true;
    }

    let updatedRoom = roomManager.leaveRoom(socketId);

    if (gameWasInProgress && updatedRoom) {
      updatedRoom = roomManager.returnToLobby(roomCode) ?? updatedRoom;
    }

    if (gameWasInProgress) {
      activeGames.delete(roomCode);
    }

    socketUsers.delete(socketId);
    socket?.leave(roomCode);

    try {
      const [game] = await db
        .select({
          id: games.id,
          status: games.status,
        })
        .from(games)
        .where(eq(games.roomCode, roomCode))
        .limit(1);

      await db.transaction(async (tx) => {
        if (!game) {
          return;
        }

        // Završene partije čuvamo u povijesti.
        if (game.status === "finished") {
          return;
        }

        // Brišemo igrača samo iz nedovršene partije.
        if (userId !== undefined) {
          await tx
            .delete(gamePlayers)
            .where(
              and(
                eq(gamePlayers.gameId, game.id),
                eq(gamePlayers.userId, userId),
              ),
            );
        }

        // Ako je soba prazna, brišemo nedovršenu partiju.
        if (!updatedRoom) {
          await tx.delete(games).where(eq(games.id, game.id));

          return;
        }

        if (gameWasInProgress) {
          await tx
            .update(games)
            .set({ status: "waiting" })
            .where(eq(games.id, game.id));
        }
        // Ako je domaćin otišao, dodjeljujemo novog.
        await tx
          .update(gamePlayers)
          .set({ isHost: false })
          .where(eq(gamePlayers.gameId, game.id));

        const newHost = updatedRoom.players.find((player) => player.isHost);

        if (newHost) {
          await tx
            .update(gamePlayers)
            .set({ isHost: true })
            .where(
              and(
                eq(gamePlayers.gameId, game.id),
                eq(gamePlayers.userId, newHost.userId),
              ),
            );
        }
      });

      if (!updatedRoom) {
        io.to(roomCode).emit("room_closed");
        io.emit("public_rooms_updated", roomManager.listPublicRooms());
        return true;
      }

      if (gameWasInProgress) {
        const message = `${departingPlayer?.username ?? "Igrač"} je napustio igru. Partija je prekinuta.`;
        io.to(roomCode).emit("game_aborted", {
          room: updatedRoom,
          message,
        });
      }

      io.to(roomCode).emit("room_updated", updatedRoom);
      io.emit("public_rooms_updated", roomManager.listPublicRooms());

      return true;
    } catch (error) {
      console.error("Greška pri ažuriranju sobe u bazi:", error);

      if (!updatedRoom) {
        io.to(roomCode).emit("room_closed");
      } else {
        if (gameWasInProgress) {
          io.to(roomCode).emit("game_aborted", {
            room: updatedRoom,
            message: `${departingPlayer?.username ?? "Igrač"} je napustio igru. Partija je prekinuta.`,
          });
        }

        io.to(roomCode).emit("room_updated", updatedRoom);
      }

      io.emit("public_rooms_updated", roomManager.listPublicRooms());
      return true;
    }
  } finally {
    pendingRoomOperations.delete(roomCode);
  }
}

// Pokretanje servera
const start = async () => {
  try {
    await app.listen({
      port: 3001,
      host: "127.0.0.1",
    });

    console.log("Belot server radi na portu 3001");
  } catch (error) {
    app.log.error(error);
    await pool.end();
    process.exitCode = 1;
  }
};

start();
