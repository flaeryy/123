
import "dotenv/config";
import { io, type Socket } from "socket.io-client";

type Response = {
    success: boolean;
    message?: string;
    room?: {
        code: string;
    };
};

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
    const socket = io("http://127.0.0.1:3001", {
        auth: { token },
        reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
    });

    return socket;
}

async function main() {
    const email = process.env.BELOT_TEST_EMAIL;
    const password = process.env.BELOT_TEST_PASSWORD;

    if (!email || !password) {
        throw new Error("Nedostaju testni podaci za prijavu.");
    }

    const loginResponse = await fetch("http://127.0.0.1:3001/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const loginData = await loginResponse.json() as {
        sessionToken?: string;
        message?: string;
    };

    if (!loginResponse.ok || !loginData.sessionToken) {
        throw new Error(loginData.message ?? "Prijava nije uspjela.");
    }

    const token = loginData.sessionToken;
    const sockets: Socket[] = [];

    try {
        const first = await connectSocket(token);
        sockets.push(first);

        const second = await connectSocket(token);
        sockets.push(second);

      const created = await emitAck(first, "create_room", {
    username: "TestBelot",
    isPublic: true,
});

        if (!created.success || !created.room) {
            throw new Error(created.message ?? "Kreiranje sobe nije uspjelo.");
        }

        const joined = await emitAck(second, "join_room", {
            roomCode: created.room.code,
        });

        if (joined.success) {
            throw new Error("Isti račun zauzeo je dva mjesta u sobi.");
        }

        console.log("TEST - isti račun ne može zauzeti dva mjesta: PROŠAO");
        console.log("Poruka:", joined.message);
        console.log("\nTest višestrukog zauzimanja mjesta je prošao!");
    } finally {
        for (const socket of sockets) {
            socket.disconnect();
        }
    }
}

main().catch((error) => {
    console.error("TEST NIJE PROŠAO:", error);
    process.exitCode = 1;
});
