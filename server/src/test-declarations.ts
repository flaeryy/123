// Funkcije za usporedbu i pronalaženje zvanja.
import {
  compareAllDeclarations,
  findSequences,
  findFourOfAKinds,
  hasBela,
  createGameDeclarations,
  calculateFinalScore,
} from "./game/rules.js";

// Tip karte uvozimo iz datoteke u kojoj je definiran.
import type { Card } from "./game/cards.js";
// Karte prvog igrača: terca u srcu.
const player1: Card[] = [
  { suit: "hearts", rank: "7" },
  { suit: "hearts", rank: "8" },
  { suit: "hearts", rank: "9" },
  { suit: "clubs", rank: "A" },
  { suit: "clubs", rank: "K" },
  { suit: "spades", rank: "7" },
  { suit: "diamonds", rank: "8" },
  { suit: "spades", rank: "Q" },
];

// Karte drugog igrača: četiri kralja i dodatne karte.
// Igrač 2 ima dva četverca: četiri kralja i četiri desetke.
const player2: Card[] = [
  { suit: "hearts", rank: "K" },
  { suit: "diamonds", rank: "K" },
  { suit: "clubs", rank: "K" },
  { suit: "spades", rank: "K" },
  { suit: "hearts", rank: "10" },
  { suit: "diamonds", rank: "10" },
  { suit: "clubs", rank: "10" },
  { suit: "spades", rank: "10" },
];

// Karte trećeg igrača: kvarta u trefu.
const player3: Card[] = [
  { suit: "clubs", rank: "7" },
  { suit: "clubs", rank: "8" },
  { suit: "clubs", rank: "9" },
  { suit: "clubs", rank: "10" },
  { suit: "hearts", rank: "Q" },
  { suit: "diamonds", rank: "A" },
  { suit: "spades", rank: "8" },
  { suit: "diamonds", rank: "9" },
];

// Karte četvrtog igrača: nema zvanja.
const player4: Card[] = [
  { suit: "hearts", rank: "10" },
  { suit: "diamonds", rank: "10" },
  { suit: "spades", rank: "10" },
  { suit: "hearts", rank: "J" },
  { suit: "diamonds", rank: "Q" },
  { suit: "clubs", rank: "Q" },
  { suit: "spades", rank: "A" },
  { suit: "diamonds", rank: "J" },
];

// Prikupljamo sva zvanja četiriju igrača.
const hands = [player1, player2, player3, player4];

const allSequences = hands.flatMap((hand, index) =>
  findSequences(hand, index + 1),
);

// Prikupljamo sva zvanja četiriju istih karata svih igrača.
const allFourOfAKind = hands.flatMap((hand, index) =>
  findFourOfAKinds(hand, index + 1),
);
// Uspoređujemo zvanja, a prvi igrač započinje prvi štih.
const result = compareAllDeclarations(
  allSequences,
  allFourOfAKind,
  1,
);

// Ispisujemo rezultat testiranja.
console.log("Pronađena nizanja:", allSequences);
console.log("Pronađene četiri iste:", allFourOfAKind);
console.log("Rezultat usporedbe:", result);


// Test bele: kralj i dama u boji aduta.
const belaHand: Card[] = [
  { suit: "hearts", rank: "K" },
  { suit: "hearts", rank: "Q" },
  { suit: "clubs", rank: "A" },
  { suit: "clubs", rank: "10" },
  { suit: "spades", rank: "7" },
  { suit: "spades", rank: "8" },
  { suit: "diamonds", rank: "9" },
  { suit: "diamonds", rank: "J" },
];

console.log(
  "Test bele (očekivano true):",
  hasBela(belaHand, "hearts")
);

console.log(
  "Test bele bez kralja i dame (očekivano false):",
  hasBela(player1, "hearts")
);

// TEST 1: Ekipa 1 je zvala adut i prolazi.
const declarationsPass = createGameDeclarations(
  { winningTeam: 1, points: 50, winningPlayer: 1 },
  20,
  10,
);

const resultPass = calculateFinalScore(
  { team1: 100, team2: 62 },
  1,
  declarationsPass,
);

console.log("\nTEST PROLAZA:", resultPass);
// Očekivano: ekipa 1 = 170, ekipa 2 = 72.


// TEST 2: Ekipa 1 je zvala adut i pada.
const declarationsFall = createGameDeclarations(
  { winningTeam: 1, points: 50, winningPlayer: 1 },
  20,
  10,
);

const resultFall = calculateFinalScore(
  { team1: 70, team2: 92 },
  1,
  declarationsFall,
);

console.log("\nTEST PADA:", resultFall);
// Očekivano: ekipa 1 = 0, ekipa 2 = 242.


// TEST 3: Ekipa 1 pada, a ekipa 2 ima pobjednička zvanja.
const declarationsOpponent = createGameDeclarations(
  { winningTeam: 2, points: 70, winningPlayer: 2 },
  20,
  10,
);

const resultOpponent = calculateFinalScore(
  { team1: 70, team2: 92 },
  1,
  declarationsOpponent,
);

console.log("\nTEST ZVANJA PROTIVNIKA:", resultOpponent);
// Očekivano: ekipa 1 = 0, ekipa 2 = 262.