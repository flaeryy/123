
import { io } from "socket.io-client";

// Provjera da server odbija nevaljanu Socket.IO vezu
async function expectConnectionRejected(
    label: string,
    token?: string,
): Promise<void> {
    const socket = io("http://127.0.0.1:3001", {
        auth: token ? { token } : {},
        reconnection: false,
        timeout: 5000,
    });

    try {
        await new Promise<void>((resolve, reject) => {
            socket.once("connect", () => {
                reject(new Error("Server je prihvatio neovlaštenu vezu."));
            });

            socket.once("connect_error", () => {
                resolve();
            });

            socket.once("connect_timeout", () => {
                reject(new Error("Isteklo je vrijeme čekanja na odgovor servera."));
            });
        });

        console.log(`${label}: PROŠAO`);
    } finally {
        socket.disconnect();
    }
}

async function main() {
    await expectConnectionRejected(
        "TEST 1 - povezivanje bez tokena",
    );

    await expectConnectionRejected(
        "TEST 2 - povezivanje s nevaljanim tokenom",
        "ovo-nije-valjan-token",
    );

    console.log("\nSvi testovi autentifikacije su prošli!");
}

main().catch((error) => {
    console.error("TEST NIJE PROŠAO:", error);
    process.exitCode = 1;
});
