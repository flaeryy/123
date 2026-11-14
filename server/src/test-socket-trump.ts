import { io, type Socket } from "socket.io-client";

type Response = {
  success: boolean;
  message?: string;
  room?: {
    code: string;
  };
};

type GameView = {
  roomCode: string;
  phase: string;
  trumpSuit: string | null;
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
    const callback = (response: Response) => resolve(response);

    if (data === undefined) {
      socket.emit(event, callback);
    } else {
      socket.emit(event, data, callback);
    }
  });
}

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, (data: T) => resolve(data));
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
    await Promise.all(
      players.map(
        (socket) =>
          new Promise<void>((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
          }),
      ),
    );

    console.log("Četiri igrača spojena.");

    const suffix = Date.now();

    const created = await emitAck(players[0], "create_room", {
      username: `Trump1_${suffix}`,
      isPublic: true,
    });

    if (!created.success || !created.room) {
      throw new Error(created.message ?? "Kreiranje sobe nije uspjelo.");
    }

    const roomCode = created.room.code;

    for (let i = 1; i < 4; i++) {
      const joined = await emitAck(players[i], "join_room", {
        username: `Trump${i + 1}_${suffix}`,
        roomCode,
      });

      if (!joined.success) {
        throw new Error(joined.message ?? "Ulazak u sobu nije uspio.");
      }
    }

    const startPromises = players.map((socket) =>
      waitForEvent<GameView>(socket, "game_started"),
    );

    const started = await emitAck(players[0], "start_game");

    if (!started.success) {
      throw new Error(started.message ?? "Pokretanje nije uspjelo.");
    }

    await Promise.all(startPromises);

    console.log("Partija pokrenuta.");

    // Pripremamo primanje novog stanja prije odabira aduta.
    const statePromises = players.map((socket) =>
      waitForEvent<GameView>(socket, "game_state"),
    );

    const trumpResult = await emitAck(players[0], "choose_trump", {
      trumpSuit: "hearts",
    });

    if (!trumpResult.success) {
      throw new Error(trumpResult.message ?? "Odabir aduta nije uspio.");
    }

    let states = await Promise.all(statePromises);

    console.log("Adut odabran; faza zvanja započela.");

    for (let i = 0; i < 4; i++) {
      const view = states[i];

      if (view.phase !== "declarations") {
        throw new Error(`Igrač ${i + 1}: nije u fazi zvanja.`);
      }

      if (view.trumpSuit !== "hearts") {
        throw new Error(`Igrač ${i + 1}: pogrešan adut.`);
      }

      if (view.myHand.length !== 8) {
        throw new Error(`Igrač ${i + 1} nema 8 karata.`);
      }

      if (view.remainingCards.length !== 0) {
        throw new Error("Preostale karte nisu pravilno skrivene.");
      }

      for (let j = 0; j < 4; j++) {
        const expectedCards = i === j ? 8 : 0;

        if (view.players[j].hand.length !== expectedCards) {
          throw new Error(
            `Igrač ${i + 1} vidi tuđe karte ili nema svoje karte.`,
          );
        }
      }

      console.log(`Igrač ${i + 1}: 8 karata i privatnost PROŠLI.`);
    }

    for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
      const declarationStates = players.map((socket) =>
        waitForEvent<GameView>(socket, "game_state"),
      );
      const declarationResponse = await emitAck(
        players[playerIndex],
        "submit_declarations",
        { cards: [] },
      );

      if (!declarationResponse.success) {
        throw new Error(
          declarationResponse.message ?? `Igrač ${playerIndex + 1} nije završio zvanje.`,
        );
      }

      states = await Promise.all(declarationStates);
    }

    if (states.some((view) => view.phase !== "playing")) {
      throw new Error("Igra nije počela nakon završetka kruga zvanja.");
    }

    console.log("");
    console.log("SVA TESTIRANJA ADUTA SU PROŠLA!");
  } catch (error) {
    console.error("TEST NIJE PROŠAO:", error);
  } finally {
    players.forEach((socket) => socket.disconnect());
  }
}

main();