import {
  createDeck,
  shuffleDeck,
  dealInitialCards,
  dealRemainingCards,
  
} from "./game/cards.js";

import { getTrickPoints,createTeamScores,addTrickPoints,TrickResult,isGameFinished,calculateFinalScore,GameDeclarations,getLegalCards,
isLegalMove, } from "./game/rules.js";

import type { Card } from "./game/cards.js";
import type { PlayedCard } from "./game/rules.js";

const shuffledDeck = shuffleDeck(createDeck());
const deal = dealInitialCards(shuffledDeck);

deal.hands.forEach((hand, index) => {
  console.log(`Igrač ${index + 1}:`, hand.length, "karata");
});

console.log("Preostalo u talonu:", deal.remainingCards.length);

console.log("Broj karata:", shuffledDeck.length);
console.log("Promiješani špil:");
console.log(shuffledDeck);

const completedDeal = dealRemainingCards(deal);

console.log("\nZAVRŠNO DIJELJENJE:");

console.log(JSON.stringify(completedDeal, null, 2));


// Testiramo izračun bodova jednog štiha.
const testTrick = [
  {
    playerNumber: 1,
    card: { suit: "hearts", rank: "J" },
  },
  {
    playerNumber: 2,
    card: { suit: "diamonds", rank: "A" },
  },
  {
    playerNumber: 3,
    card: { suit: "hearts", rank: "9" },
  },
  {
    playerNumber: 4,
    card: { suit: "clubs", rank: "10" },
  },
] as const;

// Srca su adut, a zadnji štih donosi dodatnih 10 bodova.
const trickPoints = getTrickPoints(
  [...testTrick],
  "hearts",
  true,
);

console.log("Bodovi zadnjeg štiha:", trickPoints);


// Početni rezultat obje ekipe.
let scores = createTeamScores();

console.log("Početni rezultat:", scores);

// Prvi štih osvaja ekipa 1 i dobiva 25 bodova.
const firstTrick: TrickResult = {
  winner: {
    playerNumber: 1,
    card: { suit: "hearts", rank: "J" },
  },
  winningTeam: 1,
  points: 25,
};

scores = addTrickPoints(scores, firstTrick);

console.log("Nakon prvog štiha:", scores);

// Drugi štih osvaja ekipa 2 i dobiva 40 bodova.
const secondTrick: TrickResult = {
  winner: {
    playerNumber: 2,
    card: { suit: "diamonds", rank: "A" },
  },
  winningTeam: 2,
  points: 40,
};

scores = addTrickPoints(scores, secondTrick);

console.log("Nakon drugog štiha:", scores);

// Testiramo prepoznavanje završetka partije.
console.log("Nakon 7 štihova:", isGameFinished(7));
console.log("Nakon 8 štihova:", isGameFinished(8));


// Testiramo konačni obračun bodova partije.

// Slučaj 1: Ekipa 1 je zvala adut i osvojila više bodova.

// Testni podaci za zvanja i belu.
// U ovom testu nema zvanja ni bele.
const testDeclarations: GameDeclarations = {
  winningTeam: null,
  points: 0,
  team1Bela: 0,
  team2Bela: 0,
};
const successfulContract = calculateFinalScore(
  { team1: 95, team2: 67 },
  1,testDeclarations,
);

console.log("Uspješno zvanje:", successfulContract);

// Testni podaci za zvanja i belu.
// U ovom testu nema zvanja ni bele.
// Slučaj 2: Ekipa 1 je zvala adut, ali je osvojila manje bodova.
const failedContract = calculateFinalScore(
  { team1: 80, team2: 82 },
  1,testDeclarations,
);

console.log("Neuspješno zvanje:", failedContract);



// Testiramo padanje ekipe koja je zvala adut.

// Ekipa 1 je pobijedila u usporedbi zvanja i ima 200 bodova.
// Ekipa 1 također ima belu vrijednu 20 bodova.
const declarationsWithBela: GameDeclarations = {
  winningTeam: 1,
  points: 200,
  team1Bela: 20,
  team2Bela: 0,
};

// Ekipa 1 zvala je adut, ali je osvojila samo 80 bodova.
// Ekipa 2 osvojila je 82 boda.
const failedContractWithDeclarations = calculateFinalScore(
  { team1: 80, team2: 82 },
  1,
  declarationsWithBela,
);

console.log(
  "Padanje s 200 bodova zvanja i 20 bodova bele:",
  failedContractWithDeclarations,
);



// Testiramo uspješno zvanje uz zvanja i belu.

// Ekipa 1 ima 200 bodova zvanja i 20 bodova bele.
// Ekipa 2 ima 20 bodova bele.
const successfulDeclarations: GameDeclarations = {
  winningTeam: 1,
  points: 200,
  team1Bela: 20,
  team2Bela: 20,
};

// Ekipa 1 zvala je adut i osvojila više osnovnih bodova.
const successfulContractWithDeclarations = calculateFinalScore(
  { team1: 95, team2: 67 },
  1,
  successfulDeclarations,
);

console.log(
  "Prolazak s 200 bodova zvanja i belom:",
  successfulContractWithDeclarations,
);



// Test 1: Moramo nadjačati traženu boju ako imamo jaču kartu.
const hand1: Card[] = [
  { suit: "hearts", rank: "A" },
  { suit: "hearts", rank: "7" },
];

const played1: PlayedCard[] = [
  { playerNumber: 1, card: { suit: "hearts", rank: "10" } },
];

console.log(
  "Test 1 - Nadjačavanje boje:",
  isLegalMove(hand1, { suit: "hearts", rank: "A" }, "hearts", "spades", played1),
  isLegalMove(hand1, { suit: "hearts", rank: "7" }, "hearts", "spades", played1),
);

// Test 2: Ako nemamo traženu boju, moramo sjeći adutom.
const hand2: Card[] = [
  { suit: "spades", rank: "7" },
  { suit: "clubs", rank: "A" },
];

const played2: PlayedCard[] = [
  { playerNumber: 1, card: { suit: "hearts", rank: "10" } },
];

console.log(
  "Test 2 - Obavezno rezanje:",
  isLegalMove(hand2, { suit: "spades", rank: "7" }, "hearts", "spades", played2),
  isLegalMove(hand2, { suit: "clubs", rank: "A" }, "hearts", "spades", played2),
);

// Test 3: Ako je adut već bačen, moramo ga nadjačati jačim.
const hand3: Card[] = [
  { suit: "spades", rank: "J" },
  { suit: "spades", rank: "7" },
];

const played3: PlayedCard[] = [
  { playerNumber: 1, card: { suit: "hearts", rank: "10" } },
  { playerNumber: 2, card: { suit: "spades", rank: "9" } },
];

console.log(
  "Test 3 - Nadjačavanje aduta:",
  isLegalMove(hand3, { suit: "spades", rank: "J" }, "hearts", "spades", played3),
  isLegalMove(hand3, { suit: "spades", rank: "7" }, "hearts", "spades", played3),
);

// Test 4: Nakon što je druga boja presječena adutom,
// možemo baciti slabiji adut ako nemamo traženu boju.
const hand4: Card[] = [
  { suit: "spades", rank: "7" },
];

const played4: PlayedCard[] = [
  { playerNumber: 1, card: { suit: "hearts", rank: "10" } },
  { playerNumber: 2, card: { suit: "spades", rank: "9" } },
];

console.log(
  "Test 4 - Slabiji adut nakon rezanja:",
  isLegalMove(hand4, { suit: "spades", rank: "7" }, "hearts", "spades", played4),
);