import {
  createGameState,
  passTrump,
  chooseTrump,
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
console.log("Završna faza:", game.phase);
console.log("Završeni štihovi:", game.completedTricks);
console.log("Bodovi ekipe 1:", game.team1TrickPoints);
console.log("Bodovi ekipe 2:", game.team2TrickPoints);
console.log(
  "Ukupno bodova:",
  game.team1TrickPoints + game.team2TrickPoints
);
console.log(
  "Preostale karte igrača:",
  game.players.map((player) => player.hand.length)
);