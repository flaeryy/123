
import { io } from "socket.io-client";

const SERVER_URL = "http://127.0.0.1:3001";

function connectPlayer(username: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL);

    socket.on("connect", () => {
      console.log(`${username} spojen.`);
      resolve(socket);
    });

    socket.on("connect_error", reject);
  });
}

function createRoom(socket: any, username: string): Promise<any> {
  return new Promise((resolve, reject) => {
    socket.emit("create_room", { username }, (response: any) => {
      if (!response.success) {
        reject(new Error(response.message));
        return;
      }

      resolve(response.room);
    });
  });
}

function joinRoom(
  socket: any,
  username: string,
  roomCode: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    socket.emit(
      "join_room",
      { username, roomCode },
      (response: any) => {
        if (!response.success) {
          reject(new Error(response.message));
          return;
        }

        resolve(response.room);
      },
    );
  });
}

function leaveRoom(socket: any): Promise<any> {
  return new Promise((resolve) => {
    socket.emit("leave_room", (response: any) => {
      resolve(response);
    });
  });
}

async function main() {
  const players: any[] = [];

  try {
    // Spajanje pet igrača
    for (let i = 1; i <= 5; i++) {
      players.push(await connectPlayer(`TestIgrac${i}`));
    }

    console.log("\n--- KREIRANJE SOBE ---");

    const room = await createRoom(players[0], "TestIgrac1");
    const roomCode = room.code;

    console.log("Soba kreirana:", roomCode);
    console.log("Broj igrača:", room.players.length);

    console.log("\n--- PRIDRUŽIVANJE IGRAČA ---");

    for (let i = 1; i <= 3; i++) {
      const joinedRoom = await joinRoom(
        players[i],
        `TestIgrac${i + 1}`,
        roomCode,
      );

      console.log(
        `Igrač ${i + 1} pridružen. Broj igrača:`,
        joinedRoom.players.length,
      );
    }

    console.log("\n--- PROVJERA PUNE SOBE ---");

    try {
      await joinRoom(players[4], "TestIgrac5", roomCode);
      console.log("GREŠKA: Peta osoba se uspjela pridružiti!");
    } catch (error) {
      console.log(
        "Očekivano odbijanje:",
        error instanceof Error ? error.message : error,
      );
    }

    console.log("\n--- PROVJERA NAPUŠTANJA SOBE ---");

    const updatedRoomPromise = new Promise<any>((resolve) => {
      players[1].once("room_updated", resolve);
    });

    const leaveResponse = await leaveRoom(players[0]);

    console.log("Domaćin napustio sobu:", leaveResponse.success);

    const updatedRoom = await updatedRoomPromise;

    console.log("Novi domaćin:", updatedRoom.players.find(
      (player: any) => player.isHost,
    )?.username);

    console.log("Preostali igrači:", updatedRoom.players.length);

    console.log("\n--- TEST USPJEŠNO ZAVRŠEN ---");
  } catch (error) {
    console.error("\nTEST NIJE USPIO:", error);
  } finally {
    for (const player of players) {
      player.disconnect();
    }
  }
}

main();
