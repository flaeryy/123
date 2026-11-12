
import {
    createGameState,
    chooseTrump,
    playCard,
} from "./game/game-engine.js";

import type { Card, Suit } from "./game/cards.js";

const players = [
    { socketId: "p1", username: "Igrac1" },
    { socketId: "p2", username: "Igrac2" },
    { socketId: "p3", username: "Igrac3" },
    { socketId: "p4", username: "Igrac4" },
];

// Pripremamo partiju.
let state = createGameState("TESTBEL", players, 1);

// Namještamo poznate karte kako test ne bi ovisio o slučajnom dijeljenju.
const trumpSuit: Suit = "hearts";

const testHands: Card[][] = [
    [
        { suit: "hearts", rank: "K" },
        { suit: "hearts", rank: "Q" },
        { suit: "clubs", rank: "7" },
        { suit: "clubs", rank: "8" },
        { suit: "diamonds", rank: "7" },
        { suit: "spades", rank: "7" },
        { suit: "clubs", rank: "9" },
        { suit: "diamonds", rank: "8" },
    ],
    [
        { suit: "hearts", rank: "7" },
        { suit: "hearts", rank: "8" },
        { suit: "clubs", rank: "10" },
        { suit: "clubs", rank: "J" },
        { suit: "diamonds", rank: "9" },
        { suit: "diamonds", rank: "10" },
        { suit: "spades", rank: "8" },
        { suit: "spades", rank: "9" },
    ],
    [
        { suit: "hearts", rank: "9" },
        { suit: "hearts", rank: "10" },
        { suit: "clubs", rank: "Q" },
        { suit: "clubs", rank: "K" },
        { suit: "diamonds", rank: "J" },
        { suit: "diamonds", rank: "Q" },
        { suit: "spades", rank: "10" },
        { suit: "spades", rank: "J" },
    ],
    [
        { suit: "hearts", rank: "A" },
        { suit: "clubs", rank: "A" },
        { suit: "diamonds", rank: "A" },
        { suit: "spades", rank: "Q" },
        { suit: "spades", rank: "K" },
        { suit: "spades", rank: "A" },
        { suit: "diamonds", rank: "K" },
        { suit: "clubs", rank: "A" },
    ],
];

// Postavljamo testno stanje nakon odabira aduta.
state = {
    ...state,
    phase: "playing",
    trumpSuit,
    trumpCallerPlayerNumber: 1,
    callingTeam: 1,
    currentPlayerNumber: 1,
    players: state.players.map((player, index) => ({
        ...player,
        hand: testHands[index],
    })),
};

// Test 1: Bela se mora najaviti.
try {
    playCard(
        state,
        1,
        { suit: "hearts", rank: "K" }
    );

    throw new Error("TEST NIJE PROŠAO: bela nije morala biti najavljena.");
} catch (error) {
    if (
        error instanceof Error &&
        error.message.includes("Moraš najaviti belu")
    ) {
        console.log("TEST 1 PROŠAO: najava bele je obavezna.");
    } else {
        throw error;
    }
}

// Test 2: Najavljena bela donosi 20 bodova.
state = playCard(
    state,
    1,
    { suit: "hearts", rank: "K" },
    true
);

console.log(
    "TEST 2:",
    state.team1Bela === 20 &&
    state.team2Bela === 0 &&
    state.belaAnnouncedBy === 1
        ? "PROŠAO"
        : "NIJE PROŠAO"
);

// Test 3: Drugi igrač ne može najaviti drugu belu.
const stateForSecondAnnouncement = {
    ...state,
    currentPlayerNumber: 2,
};

try {
    playCard(
        stateForSecondAnnouncement,
        2,
        { suit: "hearts", rank: "7" },
        true
    );

    throw new Error("TEST NIJE PROŠAO: druga bela je bila dopuštena.");
} catch (error) {
    if (
        error instanceof Error &&
        error.message.includes("Nemaš pravo najaviti belu")
    ) {
        console.log("TEST 3 PROŠAO: druga bela nije dopuštena.");
    } else {
        throw error;
    }
}

// Test 4: Bodovi bele ostaju samo jednom dodijeljeni.
console.log(
    "TEST 4:",
    state.team1Bela === 20 && state.team2Bela === 0
        ? "PROŠAO"
        : "NIJE PROŠAO"
);
