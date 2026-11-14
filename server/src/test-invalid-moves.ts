
import {
    createGameState,
    chooseTrump,
    submitDeclarations,
    playCard,
} from "./game/game-engine.js";

// Provjerava odbija li server neispravan potez.
function checkRejected(
    name: string,
    action: () => unknown
) {
    let rejected = false;

    try {
        action();
    } catch (error) {
        rejected = true;
        console.log(
            `${name}: ${rejected ? "PROŠAO" : "NIJE PROŠAO"}`
        );
        console.log("Poruka:", (error as Error).message);
    }

    if (!rejected) {
        console.log(`${name}: NIJE PROŠAO`);
        throw new Error(`Server nije odbio potez: ${name}`);
    }
}

// Pripremamo testnu partiju s četiri igrača.
const players = [
    { socketId: "igrac-1", username: "Igrač 1" },
    { socketId: "igrac-2", username: "Igrač 2" },
    { socketId: "igrac-3", username: "Igrač 3" },
    { socketId: "igrac-4", username: "Igrač 4" },
];

const initialState = createGameState(
    "TEST1234",
    players,
    1
);

// Igrač 1 odabire adut.
let gameState = chooseTrump(initialState, 1, "hearts");

for (const playerNumber of [1, 2, 3, 4] as const) {
    gameState = submitDeclarations(gameState, playerNumber, []);
}

// TEST 1: Igrač 2 pokušava igrati prije svog reda.
checkRejected("TEST 1 - potez izvan reda", () => {
    playCard(
        gameState,
        2,
        gameState.players[1].hand[0]
    );
});

// TEST 2: Igrač 1 pokušava odigrati kartu koje nema.
checkRejected("TEST 2 - karta koja nije u ruci", () => {
    playCard(
        gameState,
        1,
        { suit: "hearts", rank: "7" }
    );
});

// TEST 3: Igrač pokušava odigrati kartu prije odabira aduta.
checkRejected("TEST 3 - igranje prije odabira aduta", () => {
    playCard(
        initialState,
        1,
        initialState.players[0].hand[0]
    );
});

// TEST 4: Pokušaj igranja nakon završetka partije.
const finishedState = {
    ...gameState,
    phase: "finished" as const,
};

checkRejected("TEST 4 - igranje nakon završetka partije", () => {
    playCard(
        finishedState,
        1,
        finishedState.players[0].hand[0]
    );
});

console.log("\nSvi testovi neispravnih poteza uspješno su završeni!");
