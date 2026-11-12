
import {
    createGameDeclarations,
    calculateFinalScore,
} from "./game/rules.js";

function check(
    name: string,
    actual: unknown,
    expected: unknown
) {
    const passed =
        JSON.stringify(actual) === JSON.stringify(expected);

    console.log(
        `${name}: ${passed ? "PROŠAO" : "NIJE PROŠAO"}`
    );

    if (!passed) {
        console.log("Očekivano:", expected);
        console.log("Dobiveno:", actual);
        throw new Error(`Test nije prošao: ${name}`);
    }
}

// TEST 1:
// Ekipa 1 je zvala adut i uspješno ostvarila ugovor.
// Ima 100 bodova iz štihova, 50 bodova iz zvanja i belu 20.

const declarations1 = createGameDeclarations(
    { winningTeam: 1, points: 50, winningPlayer: 1 },
    20,
    0
);

const result1 = calculateFinalScore(
    { team1: 100, team2: 62 },
    1,
    declarations1
);

check("TEST 1 - uspješan ugovor", result1, {
    team1: 170,
    team2: 62,
    winningTeam: 1,
    contractMade: true,
    declarationPoints: 50,
    team1Bela: 20,
    team2Bela: 0,
});

// TEST 2:
// Ekipa 1 je zvala adut, ali nije ostvarila ugovor.
// Njezinih 50 bodova zvanja i 20 bodova bele
// prelaze ekipi 2.

const declarations2 = createGameDeclarations(
    { winningTeam: 1, points: 50, winningPlayer: 1 },
    20,
    0
);

const result2 = calculateFinalScore(
    { team1: 70, team2: 92 },
    1,
    declarations2
);

check("TEST 2 - padanje ugovora", result2, {
    team1: 0,
    team2: 232,
    winningTeam: 2,
    contractMade: false,
    declarationPoints: 50,
    team1Bela: 0,
    team2Bela: 20,
});

// TEST 3:
// Ekipa 1 pada, ali ekipa 2 je pobijedila u zvanjima.
// Ekipa 2 zadržava svojih 70 bodova zvanja.

const declarations3 = createGameDeclarations(
    { winningTeam: 2, points: 70, winningPlayer: 2 },
    20,
    0
);

const result3 = calculateFinalScore(
    { team1: 70, team2: 92 },
    1,
    declarations3
);

check("TEST 3 - protivnička zvanja", result3, {
    team1: 0,
    team2: 252,
    winningTeam: 2,
    contractMade: false,
    declarationPoints: 70,
    team1Bela: 0,
    team2Bela: 20,
});

console.log("\nSvi testovi završnog obračuna su uspješno završeni!");
