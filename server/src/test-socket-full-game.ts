
import { io as createClient, type Socket } from "socket.io-client";
import { getLegalCards, type PlayedCard } from "./game/rules.js";
import type { Card } from "./game/cards.js";

type Response = {
    success: boolean;
    message?: string;
    room?: {
        code: string;
    };
};

type GameView = {
    phase: string;

    declarationResult: unknown | null;
    finalScore: unknown | null;
    myHand: Card[];
    trumpSuit: Card["suit"] | null;
    currentPlayerNumber: number;
    currentTrick: PlayedCard[];
    completedTricks: number;
    team1TrickPoints: number;
    team2TrickPoints: number;
    team1TricksWon: number;
    team2TricksWon: number;
    team1Bela: number;
    team2Bela: number;
    players: {
        playerNumber: number;
        username: string;
    }[];

};

const sockets: Socket[] = [];
const views: (GameView | null)[] = [null, null, null, null];

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`Isteklo vrijeme čekanja na događaj: ${event}`));
        }, 5000);

        const handler = (data: T) => {
            clearTimeout(timeout);
            resolve(data);
        };

        socket.once(event, handler);
    });
}

function emitAck(
    socket: Socket,
    event: string,
    data?: unknown,
): Promise<Response> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(
            () => reject(new Error(`Nema odgovora na događaj: ${event}`)),
            5000,
        );

        const callback = (response: Response) => {
            clearTimeout(timeout);
            resolve(response);
        };

        if (data === undefined) socket.emit(event, callback);
        else socket.emit(event, data, callback);
    });
}

async function main() {
    try {
        for (let i = 0; i < 4; i++) {
            const socket = createClient("http://127.0.0.1:3001");
            sockets.push(socket);

            await new Promise<void>((resolve, reject) => {
                socket.once("connect", () => resolve());
                socket.once("connect_error", reject);
            });

            socket.on("game_state", (view: GameView) => {
                views[i] = view;
            });

            console.log(`Igrač ${i + 1} spojen.`);
        }

        const roomResponse = await emitAck(sockets[0], "create_room", {
            username: "TestIgrac1",
            isPublic: true,
            minRating: 0,
        });

        if (!roomResponse.success || !roomResponse.room) {
            throw new Error(roomResponse.message ?? "Soba nije stvorena.");
        }

        const roomCode = roomResponse.room.code;
        console.log(`Soba stvorena: ${roomCode}`);

        for (let i = 1; i < 4; i++) {
            const response = await emitAck(sockets[i], "join_room", {
                username: `TestIgrac${i + 1}`,
                roomCode,
            });

            if (!response.success) {
                throw new Error(response.message ?? `Igrač ${i + 1} nije ušao.`);
            }
        }

        console.log("Sva četiri igrača su u sobi.");

        const gameStartedPromise = waitForEvent<GameView>(
            sockets[0],
            "game_started",
        );

        const startResponse = await emitAck(sockets[0], "start_game");

        if (!startResponse.success) {
            throw new Error(startResponse.message ?? "Partija nije pokrenuta.");
        }

        console.log("Partija pokrenuta.");

        const trumpView = await gameStartedPromise;
        if (trumpView.myHand.length !== 6) {
            throw new Error("Početna ruka nema 6 karata.");
        }

        const trumpResponse = await emitAck(sockets[0], "choose_trump", {
            trumpSuit: "hearts",
        });

        if (!trumpResponse.success) {
            throw new Error(trumpResponse.message ?? "Odabir aduta nije uspio.");
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        console.log("Adut je odabran; zvanja počinju.");

        for (let declarationPlayer = 0; declarationPlayer < 4; declarationPlayer++) {
            const declarationStatePromises = sockets.map((socket) =>
                waitForEvent<GameView>(socket, "game_state"),
            );
            const declarationResponse = await emitAck(
                sockets[declarationPlayer],
                "submit_declarations",
                { cards: [] },
            );

            if (!declarationResponse.success) {
                throw new Error(
                    declarationResponse.message ??
                    `Igrač ${declarationPlayer + 1} nije završio zvanje.`,
                );
            }

            const declarationViews = await Promise.all(declarationStatePromises);
            declarationViews.forEach((view, index) => {
                views[index] = view;
            });
        }

        if (views.some((view) => view?.phase !== "playing")) {
            throw new Error("Igra nije počela nakon kruga zvanja.");
        }

        console.log("Krug zvanja završen.");

        let playedCards = 0;

        while (
            views[0]?.phase !== "round_finished" &&
            views[0]?.phase !== "finished" &&
            playedCards < 32
        ) {
            const currentView = views[0];

            if (!currentView) {
                throw new Error("Nedostaje stanje igre.");
            }

            const playerNumber = currentView.currentPlayerNumber;
            const playerIndex = playerNumber - 1;
            const playerView = views[playerIndex];

            if (!playerView || playerView.myHand.length === 0) {
                throw new Error(`Igrač ${playerNumber} nema dostupnu ruku.`);
            }

            const leadSuit: Card["suit"] | null =
                currentView.currentTrick.length > 0
                    ? currentView.currentTrick[0].card.suit
                    : null;

            if (!currentView.trumpSuit) {
                throw new Error("Adut nije odabran.");
            }

            const legalCards = getLegalCards(
                playerView.myHand,
                leadSuit,
                currentView.trumpSuit,
                currentView.currentTrick,
            );
            if (legalCards.length === 0) {
                throw new Error(`Igrač ${playerNumber} nema dozvoljen potez.`);
            }

            const card = legalCards[0];

            console.log("\n--- DIJAGNOSTIKA POTEZA ---");
            console.log("Igrač na potezu:", playerNumber);
            console.log("Broj odigranih karata:", playedCards);
            console.log("Vodeća boja:", leadSuit);
            console.log("Adut:", currentView.trumpSuit);
            console.log("Karte u štihu:", currentView.currentTrick);
            console.log("Ruka igrača:", playerView.myHand);
            console.log("Dozvoljene karte:", legalCards);
            console.log("Odabrana karta:", card);

            const hasBela =
                playerView.myHand.some(
                    item => item.suit === currentView.trumpSuit && item.rank === "K",
                ) &&
                playerView.myHand.some(
                    item => item.suit === currentView.trumpSuit && item.rank === "Q",
                );

            const announceBela =
                hasBela &&
                card.suit === currentView.trumpSuit &&
                (card.rank === "K" || card.rank === "Q") &&
                currentView.team1Bela + currentView.team2Bela === 0;

            const nextStates = sockets.map(socket =>
                waitForEvent<GameView>(socket, "game_state"),
            );

            const response = await emitAck(
                sockets[playerIndex],
                "play_card",
                { card, announceBela },
            );

            if (!response.success) {
                await Promise.all(nextStates.map(p => p.catch(() => null)));

                throw new Error(
                    response.message ?? `Potez igrača ${playerNumber} nije uspio.`,
                );
            }

            const updatedViews = await Promise.all(nextStates);

            updatedViews.forEach((view, index) => {
                views[index] = view;
            });

            playedCards++;

            if (playedCards % 4 === 0) {
                console.log(
                    `Odigran ${playedCards / 4}. štih. Ukupno karata: ${playedCards}.`,
                );
            }
        }

        const finalView = views[0];

        if (
            !finalView ||
            (finalView.phase !== "round_finished" && finalView.phase !== "finished")
        ) {
            throw new Error("Dijeljenje nije završilo nakon 32 karte.");
        }

        if (finalView.completedTricks !== 8) {
            throw new Error("Nije odigrano točno 8 štihova.");
        }

        const totalPoints =
            finalView.team1TrickPoints + finalView.team2TrickPoints;

        if (totalPoints !== 162) {
            throw new Error(`Ukupni bodovi nisu 162, nego ${totalPoints}.`);
        }

        // Provjera završnog stanja kod sva četiri igrača.
        for (let i = 0; i < 4; i++) {
            const playerView = views[i];

            if (!playerView) {
                throw new Error(`Nedostaje završno stanje igrača ${i + 1}.`);
            }

            if (
                playerView.phase !== "round_finished" &&
                playerView.phase !== "finished"
            ) {
                throw new Error(`Igrač ${i + 1} nije dobio završno stanje dijeljenja.`);
            }

            if (playerView.finalScore === null) {
                throw new Error(`Igrač ${i + 1} nije dobio konačni rezultat.`);
            }

            if (playerView.myHand.length !== 0) {
                throw new Error(`Igrač ${i + 1} još ima karata.`);
            }
        }

        // Provjera da sva četiri igrača vide jednak konačni rezultat.
        const referenceScore = JSON.stringify(views[0]?.finalScore);

        for (let i = 1; i < 4; i++) {
            const playerScore = JSON.stringify(views[i]?.finalScore);

            if (playerScore !== referenceScore) {
                throw new Error(
                    `Igrač ${i + 1} vidi drugačiji konačni rezultat.`,
                );
            }
        }

        console.log("\nSVA TESTIRANJA CIJELE PARTIJE SU PROŠLA!");
        console.log(`Odigrano karata: ${playedCards}`);
        console.log(`Završeno štihova: ${finalView.completedTricks}`);
        console.log(`Ekipa 1: ${finalView.team1TrickPoints} bodova`);
        console.log(`Ekipa 2: ${finalView.team2TrickPoints} bodova`);
        console.log(`Ukupno: ${totalPoints} bodova`);

        console.log("\nKONAČNI REZULTAT:");
        console.log(JSON.stringify(finalView.finalScore, null, 2));

        console.log("\nProvjera sva četiri igrača: PROŠLA");
        console.log("Svi igrači dobili su jednak konačni rezultat.");
    } catch (error) {
        console.error("\nTEST NIJE PROŠAO:");
        console.error(error);
        process.exitCode = 1;
    } finally {
        for (const socket of sockets) {
            socket.disconnect();
        }
    }
}

main();
