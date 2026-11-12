import { randomInt } from "node:crypto";
import { trumpStrength, normalStrength } from "./rules.js";


export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export type Card = {
  suit: Suit;
  rank: Rank;
};

const suits: Suit[] = [
  "hearts",
  "diamonds",
  "clubs",
  "spades",
];

const ranks: Rank[] = [
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }

  return deck;
}


export function shuffleDeck(cards: Card[]): Card[] {
  const deck = [...cards];

  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);

    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}



export type InitialDeal = {
  hands: Card[][];
  remainingCards: Card[];
};

export function dealInitialCards(deck: Card[]): InitialDeal {
  if (deck.length !== 32) {
    throw new Error("Špil mora imati točno 32 karte.");
  }

  const hands: Card[][] = [[], [], [], []];

  let cardIndex = 0;

  for (let round = 0; round < 6; round++) {
    for (let player = 0; player < 4; player++) {
      hands[player].push(deck[cardIndex]);
      cardIndex++;
    }
  }

  const remainingCards = deck.slice(cardIndex);

  return {
    hands,
    remainingCards,
  };
}


export type CompletedDeal = {
  players: {
    playerNumber: number;
    cards: Card[];
  }[];
  remainingCards: Card[];
};

export function dealRemainingCards(
  initialDeal: InitialDeal,
): CompletedDeal {
  if (
    initialDeal.hands.length !== 4 ||
    initialDeal.hands.some((hand) => hand.length !== 6) ||
    initialDeal.remainingCards.length !== 8
  ) {
    throw new Error("Neispravno početno dijeljenje karata.");
  }

  const hands = initialDeal.hands.map((hand) => [...hand]);
  let cardIndex = 0;

  for (let round = 0; round < 2; round++) {
    for (let player = 0; player < 4; player++) {
      hands[player].push(initialDeal.remainingCards[cardIndex]);
      cardIndex++;
    }
  }

  return {
    players: hands.map((cards, index) => ({
      playerNumber: index + 1,
      cards,
    })),
    remainingCards: [],
  };
}

