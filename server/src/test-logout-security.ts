
import "dotenv/config";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";

const API_URL = "http://127.0.0.1:3001";

const email = process.env.BELOT_TEST_EMAIL;
const password = process.env.BELOT_TEST_PASSWORD;

if (!email || !password) {
  throw new Error(
    "Postavi BELOT_TEST_EMAIL i BELOT_TEST_PASSWORD u PowerShellu.",
  );
}

type LoginResponse = {
  success?: boolean;
  sessionToken?: string;
  message?: string;
};

type LogoutResponse = {
  success?: boolean;
  message?: string;
};

function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(API_URL, {
      auth: { token },
      reconnection: false,
      timeout: 5000,
      forceNew: true,
    });

    socket.once("connect", () => {
      resolve(socket);
    });

    socket.once("connect_error", (error) => {
      socket.close();
      reject(error);
    });
  });
}

async function expectConnectionRejected(token: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = io(API_URL, {
      auth: { token },
      reconnection: false,
      timeout: 5000,
      forceNew: true,
    });

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Isteklo je vrijeme čekanja na odbijanje veze."));
    }, 7000);

    socket.once("connect_error", () => {
      clearTimeout(timeout);
      socket.close();
      resolve();
    });

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.close();
      reject(new Error("Server je prihvatio opozvanu sesiju."));
    });
  });
}

async function main() {
  let socket: Socket | undefined;

  try {
    console.log("\n=== INTEGRACIJSKI TEST ODJAVE ===\n");

    // Prijava stvarnog korisnika
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const loginData =
      (await loginResponse.json()) as LoginResponse;

    assert.equal(
      loginResponse.status,
      200,
      `Prijava nije uspjela: ${loginData.message ?? "Nepoznata greška."}`,
    );

    assert.equal(typeof loginData.sessionToken, "string");

    const token = loginData.sessionToken!;

    console.log("TEST 1 - prijava korisnika: PROŠAO");

    // Uspostavljanje Socket.IO veze
    socket = await connectSocket(token);

    assert.equal(socket.connected, true);

    console.log("TEST 2 - spajanje s valjanom sesijom: PROŠAO");

    // Odjava i opoziv sesije na serveru
    const logoutResponse = await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const logoutData =
      (await logoutResponse.json()) as LogoutResponse;

    assert.equal(
      logoutResponse.status,
      200,
      `Odjava nije uspjela: ${logoutData.message ?? "Nepoznata greška."}`,
    );

    assert.equal(logoutData.success, true);

    console.log("TEST 3 - odjava i opoziv sesije: PROŠAO");

    // Pokušaj korištenja već uspostavljene veze nakon odjave
    const disconnected = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error("Veza nije prekinuta nakon opoziva sesije."),
        );
      }, 7000);

      socket!.once("disconnect", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    socket.emit("get_public_rooms", () => {
      // Ovaj događaj ne bi smio doći do obrađivača nakon odjave.
    });

    await disconnected;

    assert.equal(socket.connected, false);

    console.log(
      "TEST 4 - stara veza prekinuta nakon odjave: PROŠAO",
    );

    // Pokušaj nove veze s istim, opozvanim tokenom
    await expectConnectionRejected(token);

    console.log(
      "TEST 5 - ponovno spajanje s opozvanim tokenom odbijeno: PROŠAO",
    );

    console.log("\nSVI TESTOVI SIGURNOSTI ODJAVE SU PROŠLI!\n");
  } finally {
    socket?.disconnect();
  }
}

main().catch((error) => {
  console.error("\nTEST NIJE PROŠAO:");
  console.error(error);
  process.exitCode = 1;
});
