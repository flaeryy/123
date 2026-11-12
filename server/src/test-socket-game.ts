import { io, type Socket } from "socket.io-client";

type Response = {
  success: boolean;
  message?: string;
  room?: {
    code: string;
    players: unknown[];
  };
};

type GameView = {
  roomCode: string;
  phase: string;
  remainingCards: unknown[];
  myHand: unknown[];
  players: {
    socketId: string;
    hand: unknown[];
  }[];
};

function emitAck(
  socket: Socket,
  event: string,
  data?: unknown,
): Promise<Response> {
  return new Promise((resolve) => {
    const callback = (response: Response) => {
      resolve(response);
    };

    if (data === undefined) {
      socket.emit(event, callback);
    } else {
      socket.emit(event, data, callback);
    }
  });
}


function waitForGameStarted(socket: Socket): Promise<GameView> {
  return new Promise((resolve) => {
    socket.once("game_started", (state: GameView) => {
      resolve(state);
    });
  });
}

async function main() {
  const players = [
    io("http://127.0.0.1:3001"),
    io("http://127.0.0.1:3001"),
    io("http://127.0.0.1:3001"),
    io("http://127.0.0.1:3001"),
  ];

  try {
    // Čekamo povezivanje sva četiri igrača.
    await Promise.all(
      players.map(
        (socket) =>
          new Promise<void>((resolve, reject) => {
            socket.once("connect", () => resolve());
            socket.once("connect_error", reject);
          }),
      ),
    );

    console.log("Sva četiri igrača su spojena.");

    const suffix = Date.now();

    // Prvi igrač stvara javnu sobu.
    const created = await emitAck(players[0], "create_room", {
      username: `Test1_${suffix}`,
      isPublic: true,
    });

    if (!created.success || !created.room) {
      throw new Error(created.message ?? "Kreiranje sobe nije uspjelo.");
    }

    const roomCode = created.room.code;

    console.log("Soba stvorena:", roomCode);

    // Ostala tri igrača ulaze u sobu.
    for (let i = 1; i < 4; i++) {
      const joined = await emitAck(players[i], "join_room", {
        username: `Test${i + 1}_${suffix}`,
        roomCode,
      });

      if (!joined.success) {
        throw new Error(joined.message ?? `Igrač ${i + 1} nije ušao.`);
      }
    }

    console.log("Sva četiri igrača su u sobi.");

    // Pripremamo slušanje događaja prije pokretanja partije.
    const gameStartedPromises = players.map(waitForGameStarted);

    // Prvi igrač, kao domaćin, pokreće partiju.
    const started = await emitAck(players[0], "start_game");

    if (!started.success) {
      throw new Error(started.message ?? "Pokretanje partije nije uspjelo.");
    }

    const gameViews = await Promise.all(gameStartedPromises);

    console.log("Partija je pokrenuta.");

    // Provjera karata svakog igrača.
    for (let i = 0; i < 4; i++) {
      const view = gameViews[i];

      if (view.myHand.length !== 6) {
        throw new Error(`Igrač ${i + 1} nema točno 6 karata.`);
      }

      if (view.remainingCards.length !== 0) {
        throw new Error("Server je otkrio preostale karte.");
      }

      for (let j = 0; j < 4; j++) {
        const expectedCards = i === j ? 6 : 0;

        if (view.players[j].hand.length !== expectedCards) {
          throw new Error(
            `Pogrešna vidljivost karata između igrača ${i + 1} i ${j + 1}.`,
          );
        }
      }

      console.log(`Igrač ${i + 1}: privatnost karata PROŠLA.`);
    }

    console.log("");
    console.log("SVA TESTIRANJA SU PROŠLA!");
    console.log("Četiri igrača imaju po 6 svojih karata.");
    console.log("Karte ostalih igrača su skrivene.");
    console.log("Preostalih 8 karata nije poslano klijentima.");
  } catch (error) {
    console.error("TEST NIJE PROŠAO:", error);
  } finally {
    for (const socket of players) {
      socket.disconnect();
    }
  }
}

main();