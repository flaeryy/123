
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server, type Socket } from "socket.io";
import { db, pool } from "./db/index.js";
import { users, games, gamePlayers } from "./db/schema.js";
import { and, eq, sql } from "drizzle-orm";
import { roomManager, type Room } from "./rooms/room-manager.js";
import { getSessionUser } from "./auth/auth-service.js";
import {
  createGameState,
  passTrump,
  chooseTrump,
  playCard,
  type GameState,
} from "./game/game-engine.js";

import type { Card, Suit } from "./game/cards.js";
import { registerAuthRoutes } from "./auth/auth.routes.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
});

// Registracija ruta za korisničke račune
registerAuthRoutes(app);

const io = new Server(app.server, {
  cors: {
    origin: "http://localhost:3000",
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
// Aktivne partije u memoriji servera, povezane s kodom sobe.
const activeGames = new Map<string, GameState>();


// Svaki igrač dobiva samo svoje karte.
// Karte ostalih igrača, početne ruke za deklaracije
// i preostale karte ostaju skrivene.
function getPlayerGameView(state: GameState, socketId: string) {
  const player = state.players.find(
    (item) => item.socketId === socketId
  );

  if (!player) {
    throw new Error("Igrač nije dio ove partije.");
  }

  const {
    declarationHands,
    remainingCards,
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
app.get("/", async () => {
  return {
    message: "Belot server radi!",
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


  
  // KREIRANJE SOBE
  socket.on(
    "create_room",
    async (
      data: {
        isPublic?: unknown;
        minRating?: unknown;
      },
      callback,
    ) => {
      let room: Room | undefined;

      try {
        // Provjera primljenih podataka.
        if (!data || typeof data !== "object") {
          throw new Error("Neispravni podaci za stvaranje sobe.");
        }

        if (
          data.isPublic !== undefined &&
          typeof data.isPublic !== "boolean"
        ) {
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

        // Identitet i nadimak dolaze isključivo iz prijavljene sesije.
        const userId = authenticatedUser.userId;
        const username = authenticatedUser.username;

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

      try {
        // Provjera primljenih podataka.
        if (!data || typeof data !== "object") {
          throw new Error("Neispravni podaci za pridruživanje sobi.");
        }

        if (
          typeof data.roomCode !== "string" ||
          !/^[A-HJ-NP-Z2-9]{6}$/.test(data.roomCode.trim().toUpperCase())
        ) {
          throw new Error("Kod sobe nije ispravan.");
        }


        const userId = authenticatedUser.userId;
        const cleanRoomCode = data.roomCode.trim().toUpperCase();

        // Rejting se uvijek dohvaća iz baze.
        const [user] = await db
          .select({ rating: users.rating })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) {
          throw new Error("Korisnik nije pronađen u bazi.");
        }

        const joinedRoom = roomManager.joinRoom(
          socket.id,
          userId,
          username,
          cleanRoomCode,
          user.rating,
        );

        room = joinedRoom;

        const player = joinedRoom.players.find(
          (item) => item.id === socket.id,
        );

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
            seat: joinedRoom.players.length,
            isHost: false,
          });
        });

        socketUsers.set(socket.id, userId);
        socket.join(joinedRoom.code);

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

  // BIRANJE ADUTA
  socket.on(
    "choose_trump",
    (
      data: { trumpSuit: Suit },
      callback,
    ) => {
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


  // IGRANJE KARTE
  socket.on(
    "play_card",
    async (
      data: {
        card: Card;
        announceBela?: boolean;
      },
      callback,
    ) => {
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

        // Izračunavanje poteza na serveru.
        const updatedState = playCard(
          gameState,
          player.playerNumber,
          data.card,
          data.announceBela ?? false,
        );

        // Ako je partija završena, spremamo konačni rezultat u bazu.
        if (updatedState.phase === "finished") {
          if (!updatedState.finalScore || updatedState.callingTeam === null) {
            throw new Error("Konačni rezultat nije ispravno izračunat.");
          }

          const [savedGame] = await db
            .update(games)
            .set({
              status: "finished",
              finishedAt: new Date(),
              team1Score: updatedState.finalScore.team1,
              team2Score: updatedState.finalScore.team2,
              callingTeam: updatedState.callingTeam,
              contractMade: updatedState.finalScore.contractMade,
              declarationPoints: updatedState.finalScore.declarationPoints,
              team1Bela: updatedState.finalScore.team1Bela,
              team2Bela: updatedState.finalScore.team2Bela,
            })
            .where(
              and(
                eq(games.roomCode, room.code),
                eq(games.status, "playing"),
              ),
            )
            .returning({ id: games.id });

          if (!savedGame) {
            throw new Error("Rezultat nije spremljen. Partija nije pronađena ili je već završena.");
          }

          console.log("Konačni rezultat spremljen u bazu:", {
            roomCode: room.code,
            team1: updatedState.finalScore.team1,
            team2: updatedState.finalScore.team2,
          });
        }

        // Ažuriranje stanja partije u memoriji servera.
        activeGames.set(room.code, updatedState);

        // Svaki igrač dobiva vlastiti prikaz partije.
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
    },
  );


  // NAPUŠTANJE SOBE
  socket.on("leave_room", async (callback) => {
    const room = roomManager.getPlayerRoom(socket.id);

    if (room && activeGames.has(room.code)) {
      callback?.({
        success: false,
        message: "Partija je već započela. Napuštanje zasad nije podržano.",
      });
      return;
    }

    const success = await removePlayerFromRoom(socket);

    callback?.({
      success,
      message: success ? undefined : "Nisi u sobi.",
    });
  });
  // PREKID VEZE
  socket.on("disconnect", async () => {
    console.log("Igrač odspojen:", socket.id);
    await removePlayerFromRoom(socket);
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
    try {


      const existingRoom = roomManager.getPlayerRoom(socket.id);

      if (!existingRoom) {
        throw new Error("Nisi u sobi.");
      }

      if (activeGames.has(existingRoom.code)) {
        throw new Error("Partija je već pokrenuta.");
      }

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
      );

      // Ažuriranje statusa sobe u bazi.
      const [updatedGame] = await db
        .update(games)
        .set({ status: "playing" })
        .where(eq(games.roomCode, room.code))
        .returning({ id: games.id });

      if (!updatedGame) {
        throw new Error("Partija nije pronađena u bazi.");
      }

      // Spremanje aktivne partije u memoriju servera.
      activeGames.set(room.code, gameState);

      // Svaki igrač dobiva vlastiti prikaz partije.
      for (const player of room.players) {
        io.to(player.id).emit(
          "game_started",
          getPlayerGameView(gameState, player.id),
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
    }
  });


});

async function removePlayerFromRoom(socket: Socket): Promise<boolean> {
  const room = roomManager.getPlayerRoom(socket.id);

  if (!room) {
    return false;
  }

  const roomCode = room.code;
  const userId = socketUsers.get(socket.id);

  // Aktivnu partiju zasad ne mijenjamo ako igrač prekine vezu.
  if (activeGames.has(roomCode)) {
    socket.to(roomCode).emit("player_disconnected", {
      socketId: socket.id,
      message: "Igrač je izgubio vezu. Partija je privremeno zaustavljena.",
    });

    return false;
  }

  // Provjeravamo je li partija već završena.
  const [game] = await db
    .select({
      id: games.id,
      status: games.status,
    })
    .from(games)
    .where(eq(games.roomCode, roomCode))
    .limit(1);

  // Uklanjamo igrača iz memorije sobe.
  const updatedRoom = roomManager.leaveRoom(socket.id);

  socketUsers.delete(socket.id);
  socket.leave(roomCode);

  try {
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
        await tx
          .delete(games)
          .where(eq(games.id, game.id));

        return;
      }

      // Ako je domaćin otišao, dodjeljujemo novog.
      await tx
        .update(gamePlayers)
        .set({ isHost: false })
        .where(eq(gamePlayers.gameId, game.id));

      const newHost = updatedRoom.players.find(
        (player) => player.isHost,
      );

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

    io.to(roomCode).emit("room_updated", updatedRoom);
    io.emit("public_rooms_updated", roomManager.listPublicRooms());

    return true;
  } catch (error) {
    console.error("Greška pri ažuriranju sobe u bazi:", error);
    return false;
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
