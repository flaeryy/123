import {
  createGameState,
  passTrump,
  chooseTrump,
  submitDeclarations,
  createNextDeal,
  playCard,
} from "./game/game-engine.js";

import type { Suit } from "./game/cards.js";

import { getLegalCards } from "./game/rules.js";

// Četiri testna igrača.
const players = [
  { socketId: "socket-1", username: "Igrac1" },
  { socketId: "socket-2", username: "Igrac2" },
  { socketId: "socket-3", username: "Igrac3" },
  { socketId: "socket-4", username: "Igrac4" },
];

// Kreiramo novu partiju.
let game = createGameState("TEST1234", players, 1);

console.log("Početna faza:", game.phase);
console.log(
  "Broj karata svakog igrača:",
  game.players.map((player) => player.hand.length)
);
console.log("Broj preostalih karata:", game.remainingCards.length);

// Prva tri igrača preskaču.
game = passTrump(game);
game = passTrump(game);
game = passTrump(game);

console.log("Igrač na redu za adut:", game.trumpTurnPlayerNumber);

// Djelitelj bira herc.
game = chooseTrump(game, 4, "hearts" as Suit);

console.log("Odabrani adut:", game.trumpSuit);
console.log("Faza nakon odabira:", game.phase);
console.log(
  "Broj karata nakon dijeljenja:",
  game.players.map((player) => player.hand.length)
);
console.log("Preostale karte:", game.remainingCards.length);

if (game.phase !== "declarations") {
  throw new Error("Nakon aduta igra mora ući u fazu zvanja.");
}

const declarationHand = [
  { suit: "hearts", rank: "7" },
  { suit: "hearts", rank: "8" },
  { suit: "hearts", rank: "9" },
  { suit: "clubs", rank: "A" },
  { suit: "diamonds", rank: "10" },
  { suit: "spades", rank: "8" },
  { suit: "clubs", rank: "10" },
  { suit: "spades", rank: "7" },
] as const;

game = {
  ...game,
  players: game.players.map((player) =>
    player.playerNumber === 1
      ? { ...player, hand: [...declarationHand] }
      : player,
  ),
};

let outOfTurnDeclarationRejected = false;

try {
  submitDeclarations(game, 2, []);
} catch {
  outOfTurnDeclarationRejected = true;
}

if (!outOfTurnDeclarationRejected) {
  throw new Error("Zvanje izvan reda nije odbijeno.");
}

game = submitDeclarations(game, 1, [
  { suit: "hearts", rank: "7" },
  { suit: "hearts", rank: "8" },
  { suit: "hearts", rank: "9" },
]);

if (
  game.declaredSequences.length !== 1 ||
  game.phase !== "declarations" ||
  game.activeDeclaration?.playerNumber !== 1 ||
  game.activeDeclaration.points !== 20 ||
  game.team1DeclaredPoints !== 20
) {
  throw new Error("Valjano zvanje nije prihvaćeno ili je partija prerano počela.");
}

for (const playerNumber of [2, 3, 4] as const) {
  game = submitDeclarations(game, playerNumber, []);

  if (playerNumber < 4 && game.phase !== "declarations") {
    throw new Error("Partija je počela prije završetka cijelog kruga zvanja.");
  }
}

if (game.phase !== "playing" || game.declarationTurnPlayerNumber !== null) {
  throw new Error("Partija nije počela nakon završetka četvrtog reda zvanja.");
}

console.log("Krug zvanja: PROŠAO");

// Provjera oznake djelitelja.
console.log(
  "Djelitelj:",
  game.players.find((player) => player.isDealer)?.username
);


// Simuliramo svih 8 štihova.
for (let trick = 1; trick <= 8; trick++) {
  for (let turn = 1; turn <= 4; turn++) {
    const playerNumber =
      game.currentPlayerNumber as 1 | 2 | 3 | 4;

    const player = game.players.find(
      (p) => p.playerNumber === playerNumber
    );

    if (!player) {
      throw new Error("Igrač nije pronađen.");
    }

    // Određujemo boju prve karte u štihu.
    const leadSuit = game.currentTrick[0]?.card.suit ?? null;

    // Dohvaćamo karte koje igrač smije odigrati.
    const legalCards = getLegalCards(
      player.hand,
      leadSuit,
      game.trumpSuit!,
      game.currentTrick
    );

    if (legalCards.length === 0) {
      throw new Error("Igrač nema dozvoljenih karata.");
    }

    // Za test odabiremo prvu dozvoljenu kartu.
    const selectedCard = legalCards[0];

    game = playCard(game, playerNumber, selectedCard);
  }

  console.log(`Završen štih ${trick}`);
}

// Završni rezultati.
if (game.phase !== "round_finished") {
  throw new Error("Jedno dijeljenje ne smije završiti cijeli meč do 1001.");
}

const completedDeal = {
  tricks: game.completedTricks,
  team1Points: game.team1TrickPoints,
  team2Points: game.team2TrickPoints,
  matchScore: [game.team1MatchScore, game.team2MatchScore],
};

const previousDealer = game.dealerPlayerNumber;
game = createNextDeal(game);

if (
  game.phase !== "trump_call" ||
  game.roundNumber !== 2 ||
  game.dealerPlayerNumber !== ((previousDealer % 4) + 1) ||
  game.team1MatchScore !== completedDeal.matchScore[0] ||
  game.team2MatchScore !== completedDeal.matchScore[1]
) {
  throw new Error("Novo dijeljenje nije zadržalo rezultat ili rotiralo djelitelja.");
}

console.log("Sljedeće dijeljenje, rezultat i djelitelj: PROŠLI");
console.log("Faza sljedećeg dijeljenja:", game.phase);
console.log("Završeni štihovi:", completedDeal.tricks);
console.log("Bodovi ekipe 1 u dijeljenju:", completedDeal.team1Points);
console.log("Bodovi ekipe 2 u dijeljenju:", completedDeal.team2Points);
console.log("Zbroj meča:", completedDeal.matchScore.join(" : "));
console.log(
  "Ukupno bodova:",
  completedDeal.team1Points + completedDeal.team2Points
);
console.log(
  "Preostale karte igrača:",
  game.players.map((player) => player.hand.length)
);

let thresholdGame = createGameState(
  "TEST1001",
  players,
  1,
  { team1MatchScore: 1000, team2MatchScore: 999 },
);
thresholdGame = chooseTrump(thresholdGame, 1, "hearts");

for (const playerNumber of [1, 2, 3, 4] as const) {
  thresholdGame = submitDeclarations(thresholdGame, playerNumber, []);
}

for (let trick = 0; trick < 8; trick++) {
  for (let turn = 0; turn < 4; turn++) {
    const playerNumber = thresholdGame.currentPlayerNumber as 1 | 2 | 3 | 4;
    const player = thresholdGame.players.find(
      (item) => item.playerNumber === playerNumber,
    );

    if (!player || !thresholdGame.trumpSuit) {
      throw new Error("Nedostaju podaci za test praga meča.");
    }

    const legalCards = getLegalCards(
      player.hand,
      thresholdGame.currentTrick[0]?.card.suit ?? null,
      thresholdGame.trumpSuit,
      thresholdGame.currentTrick,
    );

    thresholdGame = playCard(thresholdGame, playerNumber, legalCards[0]);
  }
}

if (
  thresholdGame.phase !== "finished" ||
  thresholdGame.matchWinnerTeam === null ||
  Math.max(thresholdGame.team1MatchScore, thresholdGame.team2MatchScore) < 1001
) {
  throw new Error("Meč nije završio kada je ekipa dosegla 1001 bod.");
}

console.log(
  `Meč do 1001: PROŠAO (${thresholdGame.team1MatchScore}:${thresholdGame.team2MatchScore})`,
);