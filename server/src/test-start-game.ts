import { io } from "socket.io-client";

const sockets = Array.from(
  { length: 4 },
  () => io("http://127.0.0.1:3001"),
);

function waitForConnection(socket: ReturnType<typeof io>) {
  return new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
}

function emitAck(
  socket: ReturnType<typeof io>,
  event: string,
  data?: unknown,
): Promise<any> {
  return new Promise((resolve) => {
    if (data === undefined) {
      socket.emit(event, resolve);
    } else {
      socket.emit(event, data, resolve);
    }
  });
}

async function test() {
  try {
    await Promise.all(sockets.map(waitForConnection));

    console.log("Sva četiri igrača su spojena.");

    const created = await emitAck(sockets[0], "create_room", {
      username: "TestHost",
      isPublic: true,
    });

    if (!created.success) throw new Error(created.message);

    const roomCode = created.room.code;
    console.log("Soba kreirana:", roomCode);

    for (let i = 1; i < 4; i++) {
      const joined = await emitAck(sockets[i], "join_room", {
        username: `TestPlayer${i}`,
        roomCode,
      });

      if (!joined.success) throw new Error(joined.message);
    }

    console.log("Sva četiri igrača su u sobi.");

    const playerStart = await emitAck(sockets[1], "start_game");
    console.log("Pokušaj pokretanja od igrača:", playerStart);

    const hostStart = await emitAck(sockets[0], "start_game");
    console.log("Pokretanje od domaćina:", hostStart);

  } catch (error) {
    console.error("Test nije uspio:", error);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
  }
}

test();