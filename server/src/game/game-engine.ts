import type { Card, Rank, Suit } from "./cards.js";
import { checkDostaWinner, checkProlazWinner, type MatchSettings } from "./matchRules.js";
import {
  getLegalCards,
  getTrickWinner,
  getTrickPoints,
  hasBela,
  type PlayedCard,
  findSequences,
  findFourOfAKinds,
  compareAllDeclarations,
  type DeclarationResult,
  type SequenceDeclaration,
  type FourOfAKindDeclaration,
  createGameDeclarations,
  calculateFinalScore,
  type FinalGameResult,
} from "./rules.js";
import {
  createDeck,
  shuffleDeck,
  dealInitialCards,
  dealRemainingCards,
} from "./cards.js";

// Timovi u igri.
export type TeamNumber = 1 | 2;

// Rezultat jedne završene runde.
export type RoundResult = {
  roundNumber: number;
  team1: number;
  team2: number;
};

// Faze kroz koje prolazi jedna partija.
export type GamePhase =
  | "dealing"
  | "trump_call"
  | "dealing_remaining"
  | "declarations"
  | "playing"
  | "round_finished"
  | "finished";

// Podaci o jednom igraču.
export type GamePlayer = {
  playerNumber: 1 | 2 | 3 | 4;
  socketId: string;
  username: string;
  team: TeamNumber;
  hand: Card[];
  isDealer: boolean;
};

// Trenutačno stanje cijele partije.
export type GameState = {
  roomCode: string;
  matchSettings: MatchSettings;
  players: GamePlayer[];
  roundNumber: number;
  dealerPlayerNumber: 1 | 2 | 3 | 4;
  team1MatchScore: number;
  team2MatchScore: number;
  roundHistory: RoundResult[];
  matchWinnerTeam: TeamNumber | null;
  declarationHands: Card[][];
  phase: GamePhase;
  remainingCards: Card[];
  trumpSuit: Suit | null;
  trumpCallerPlayerNumber: number | null;
  callingTeam: TeamNumber | null;
  trumpTurnPlayerNumber: 1 | 2 | 3 | 4;
  currentPlayerNumber: number;
  currentTrick: PlayedCard[];
  completedTricks: number;
  team1TrickPoints: number;
  team2TrickPoints: number;
  team1TricksWon: number;
  team2TricksWon: number;
  team1Bela: number;
  team2Bela: number;
  belaAnnouncedBy: 1 | 2 | 3 | 4 | null;
  declarationTurnPlayerNumber: 1 | 2 | 3 | 4 | null;
  completedDeclarationPlayers: number[];
  declaredSequences: SequenceDeclaration[];
  declaredFourOfAKind: FourOfAKindDeclaration[];
  team1DeclaredPoints: number;
  team2DeclaredPoints: number;
  pendingDeclarations: {
    playerNumber: 1 | 2 | 3 | 4;
    cards: Card[];
    points: number;
  }[];

  activeDeclarations: {
    playerNumber: 1 | 2 | 3 | 4;
    cards: Card[];
    points: number;
  }[];
  declarationResult: DeclarationResult | null;
  finalScore: FinalGameResult | null;
};

// Priprema nove partije i dijeli početnih 6 karata svakom igraču.
export function createGameState(
  roomCode: string,
  players: {
    socketId: string;
    username: string;
  }[],
  startPlayerNumber: 1 | 2 | 3 | 4,
  matchProgress: {
    roundNumber?: number;
    dealerPlayerNumber?: 1 | 2 | 3 | 4;
    team1MatchScore?: number;
    team2MatchScore?: number;
    roundHistory?: RoundResult[];
    matchSettings?: MatchSettings;
  } = {},
): GameState {
  if (players.length !== 4) {
    throw new Error("Za Belot su potrebna točno 4 igrača.");
  }

  const deck = shuffleDeck(createDeck());
  const initialDeal = dealInitialCards(deck);

  const dealerPlayerNumber =
    matchProgress.dealerPlayerNumber ??
    ((((startPlayerNumber + 2) % 4) + 1) as 1 | 2 | 3 | 4);

  const gamePlayers: GamePlayer[] = players.map((player, index) => ({
    playerNumber: (index + 1) as 1 | 2 | 3 | 4,
    socketId: player.socketId,
    username: player.username,
    team: index % 2 === 0 ? 1 : 2,
    hand: initialDeal.hands[index],
    isDealer: index + 1 === dealerPlayerNumber,
  }));

  return {
    roomCode,
    // Postavke su fiksne za cijeli mec i prenose se u svako novo dijeljenje.
    matchSettings: matchProgress.matchSettings ?? { gameType: "prolaz", targetScore: 1001, turnDuration: 30 },
    players: gamePlayers,
    roundNumber: matchProgress.roundNumber ?? 1,
    dealerPlayerNumber,
    team1MatchScore: matchProgress.team1MatchScore ?? 0,
    team2MatchScore: matchProgress.team2MatchScore ?? 0,
    roundHistory: matchProgress.roundHistory ?? [],
    matchWinnerTeam: null,
    declarationHands: initialDeal.hands.map((hand) => [...hand]),
    phase: "trump_call",
    remainingCards: initialDeal.remainingCards,
    trumpSuit: null,
    trumpCallerPlayerNumber: null,
    callingTeam: null,
    trumpTurnPlayerNumber: startPlayerNumber,
    currentPlayerNumber: startPlayerNumber,
    currentTrick: [],
    completedTricks: 0,
    team1TrickPoints: 0,
    team2TrickPoints: 0,
    team1TricksWon: 0,
    team2TricksWon: 0,
    team1Bela: 0,
    team2Bela: 0,
    belaAnnouncedBy: null,
    declarationTurnPlayerNumber: null,
    completedDeclarationPlayers: [],
    declaredSequences: [],
    declaredFourOfAKind: [],
    team1DeclaredPoints: 0,
    team2DeclaredPoints: 0,
    pendingDeclarations: [],
    activeDeclarations: [],
    declarationResult: null,
    finalScore: null,
  };
}

// Igrač preskače biranje aduta.
export function passTrump(state: GameState): GameState {
  const currentPlayer = state.trumpTurnPlayerNumber;

  if (state.phase !== "trump_call") {
    throw new Error("Trenutno nije faza biranja aduta.");
  }

  if (currentPlayer === state.dealerPlayerNumber) {
    throw new Error("Djelitelj mora odabrati adut.");
  }

  return {
    ...state,
    trumpTurnPlayerNumber: ((currentPlayer % 4) + 1) as 1 | 2 | 3 | 4,
  };
}

// Igrač odabire boju aduta.
export function chooseTrump(
  state: GameState,
  playerNumber: 1 | 2 | 3 | 4,
  trumpSuit: Suit,
): GameState {
  if (state.phase !== "trump_call") {
    throw new Error("Trenutno nije faza biranja aduta.");
  }

  if (state.trumpTurnPlayerNumber !== playerNumber) {
    throw new Error("Nisi ti na redu za biranje aduta.");
  }

  if (playerNumber === state.dealerPlayerNumber && !trumpSuit) {
    throw new Error("Djelitelj mora odabrati adut.");
  }

  const completedDeal = dealRemainingCards({
    hands: state.players.map((player) => player.hand),
    remainingCards: state.remainingCards,
  });

  const updatedPlayers = state.players.map((player, index) => ({
    ...player,
    hand: completedDeal.players[index].cards,
  }));

  return {
    ...state,
    players: updatedPlayers,
    declarationHands: completedDeal.players.map((player) => [...player.cards]),
    phase: "declarations",
    remainingCards: [],
    trumpSuit,
    trumpCallerPlayerNumber: playerNumber,
    callingTeam: playerNumber === 1 || playerNumber === 3 ? 1 : 2,
    currentPlayerNumber: state.currentPlayerNumber,
    declarationTurnPlayerNumber: state.currentPlayerNumber as 1 | 2 | 3 | 4,
    completedDeclarationPlayers: [],
    declaredSequences: [],
    declaredFourOfAKind: [],
    declarationResult: null,
  };
}

export function createNextDeal(state: GameState): GameState {
  if (state.phase !== "round_finished") {
    throw new Error("Novo dijeljenje može početi tek nakon završetka runde.");
  }

  const dealerPlayerNumber = ((state.dealerPlayerNumber % 4) + 1) as
    | 1
    | 2
    | 3
    | 4;
  const firstPlayerNumber = ((dealerPlayerNumber % 4) + 1) as 1 | 2 | 3 | 4;

  return createGameState(
    state.roomCode,
    state.players.map((player) => ({
      socketId: player.socketId,
      username: player.username,
    })),
    firstPlayerNumber,
    {
      roundNumber: state.roundNumber + 1,
      dealerPlayerNumber,
      team1MatchScore: state.team1MatchScore,
      team2MatchScore: state.team2MatchScore,
      roundHistory: state.roundHistory,
      matchSettings: state.matchSettings,
    },
  );
}

const declarationRankOrder: Rank[] = ["7", "8", "9", "10", "J", "Q", "K", "A"];

function cardKey(card: Card): string {
  return `${card.suit}:${card.rank}`;
}

export function submitDeclarations(
  state: GameState,
  playerNumber: 1 | 2 | 3 | 4,
  selectedCards: Card[],
): GameState {
  if (state.phase !== "declarations") {
    throw new Error("Trenutno nije faza zvanja.");
  }

  if (state.declarationTurnPlayerNumber !== playerNumber) {
    throw new Error("Nisi ti na redu za zvanje.");
  }

  if (state.completedDeclarationPlayers.includes(playerNumber)) {
    throw new Error("Već si završio svoj red za zvanje.");
  }

  const player = state.players.find(
    (item) => item.playerNumber === playerNumber,
  );

  if (!player) {
    throw new Error("Igrač nije pronađen.");
  }

  const selectedKeys = selectedCards.map(cardKey);

  if (
    selectedKeys.length > player.hand.length ||
    new Set(selectedKeys).size !== selectedKeys.length ||
    selectedCards.some(
      (selected) =>
        !player.hand.some(
          (card) => card.suit === selected.suit && card.rank === selected.rank,
        ),
    )
  ) {
    throw new Error("Odabrane karte nisu u tvojoj ruci.");
  }

  let newSequences: SequenceDeclaration[] = [];
  let newFourOfAKind: FourOfAKindDeclaration[] = [];

  if (selectedCards.length > 0) {
    newSequences = findSequences(selectedCards, playerNumber);
    newFourOfAKind = findFourOfAKinds(selectedCards, playerNumber);

    const declaredCardKeys = new Set<string>();

    for (const sequence of newSequences) {
      const highestIndex = declarationRankOrder.indexOf(sequence.highestRank);

      const sequenceRanks = declarationRankOrder.slice(
        highestIndex - sequence.length + 1,
        highestIndex + 1,
      );

      for (const card of selectedCards) {
        if (card.suit === sequence.suit && sequenceRanks.includes(card.rank)) {
          declaredCardKeys.add(cardKey(card));
        }
      }
    }

    for (const four of newFourOfAKind) {
      for (const card of selectedCards) {
        if (card.rank === four.rank) {
          declaredCardKeys.add(cardKey(card));
        }
      }
    }

    if (declaredCardKeys.size !== selectedKeys.length) {
      throw new Error("Odabrane karte ne čine valjano zvanje.");
    }
  }

  const completedDeclarationPlayers = [
    ...state.completedDeclarationPlayers,
    playerNumber,
  ];

  const declaredSequences = [...state.declaredSequences, ...newSequences];

  const declaredFourOfAKind = [...state.declaredFourOfAKind, ...newFourOfAKind];

  const newDeclarationPoints =
    newSequences.reduce((total, declaration) => total + declaration.points, 0) +
    newFourOfAKind.reduce(
      (total, declaration) => total + declaration.points,
      0,
    );

  const pendingDeclarations =
    selectedCards.length > 0
      ? [
          ...state.pendingDeclarations,
          {
            playerNumber,
            cards: [...selectedCards],
            points: newDeclarationPoints,
          },
        ]
      : [...state.pendingDeclarations];

  // Dok sva četiri igrača ne završe, ništa se ne otkriva.
  if (completedDeclarationPlayers.length < 4) {
    return {
      ...state,
      completedDeclarationPlayers,
      declaredSequences,
      declaredFourOfAKind,
      pendingDeclarations,
      activeDeclarations: [],
      declarationTurnPlayerNumber: ((playerNumber % 4) + 1) as 1 | 2 | 3 | 4,
    };
  }

  // Uspoređujemo najjača zvanja obiju ekipa.
  const declarationResult = compareAllDeclarations(
    declaredSequences,
    declaredFourOfAKind,
    state.currentPlayerNumber as 1 | 2 | 3 | 4,
  );

  const winningTeam = declarationResult?.winningTeam ?? null;

  // Otkrivamo samo zvanja igrača pobjedničke ekipe.
  const activeDeclarations =
    winningTeam === null
      ? []
      : pendingDeclarations.filter((declaration) => {
          const declarationPlayer = state.players.find(
            (item) => item.playerNumber === declaration.playerNumber,
          );

          return declarationPlayer?.team === winningTeam;
        });

  return {
    ...state,
    phase: "playing",
    currentPlayerNumber: state.currentPlayerNumber,
    declarationTurnPlayerNumber: null,
    completedDeclarationPlayers,
    declaredSequences,
    declaredFourOfAKind,
    pendingDeclarations,
    activeDeclarations,
    team1DeclaredPoints: winningTeam === 1 ? declarationResult!.points : 0,
    team2DeclaredPoints: winningTeam === 2 ? declarationResult!.points : 0,
    declarationResult,
  };
}

// Vraća sljedećeg igrača u smjeru kazaljke na satu.
function getNextPlayer(playerNumber: 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 {
  return ((playerNumber % 4) + 1) as 1 | 2 | 3 | 4;
}

// Igrač odigrava kartu i po potrebi najavljuje belu.
export function playCard(
  state: GameState,
  playerNumber: 1 | 2 | 3 | 4,
  card: Card,
  announceBela = false,
): GameState {
  if (state.phase !== "playing") {
    throw new Error("Partija trenutno nije u fazi igranja.");
  }

  if (state.currentPlayerNumber !== playerNumber) {
    throw new Error("Nisi ti na potezu.");
  }

  const player = state.players.find((p) => p.playerNumber === playerNumber);

  if (!player) {
    throw new Error("Igrač nije pronađen.");
  }

  if (!state.trumpSuit) {
    throw new Error("Adut još nije odabran.");
  }

  const leadSuit = state.currentTrick[0]?.card.suit ?? null;

  const legalCards = getLegalCards(
    player.hand,
    leadSuit,
    state.trumpSuit,
    state.currentTrick,
  );

  const isLegal = legalCards.some(
    (legalCard) => legalCard.suit === card.suit && legalCard.rank === card.rank,
  );

  if (!isLegal) {
    throw new Error("Ta karta nije dozvoljena.");
  }

  // Provjeravamo je li odigran kralj ili dama aduta.
  const isTrumpKingOrQueen =
    card.suit === state.trumpSuit && (card.rank === "K" || card.rank === "Q");

  // Provjeravamo ima li igrač kralja i damu aduta.
  const playerHasBela = hasBela(player.hand, state.trumpSuit);

  const mustAnnounceBela = isTrumpKingOrQueen && playerHasBela;

  if (announceBela && !mustAnnounceBela) {
    throw new Error("Nemaš pravo najaviti belu.");
  }

  // Dodjeljujemo 20 bodova ekipi koja je najavila belu.
  const belaTeam1 =
    state.team1Bela + (announceBela && player.team === 1 ? 20 : 0);

  const belaTeam2 =
    state.team2Bela + (announceBela && player.team === 2 ? 20 : 0);

  const belaAnnouncedBy = announceBela ? playerNumber : state.belaAnnouncedBy;

  // Uklanjamo odigranu kartu iz ruke igrača.
  const updatedPlayers = state.players.map((p) =>
    p.playerNumber === playerNumber
      ? {
          ...p,
          hand: p.hand.filter(
            (c) => !(c.suit === card.suit && c.rank === card.rank),
          ),
        }
      : p,
  );

  // Dodajemo odigranu kartu u trenutačni štih.
  const updatedTrick = [...state.currentTrick, { playerNumber, card }];

  // Ako još nisu odigrane sve četiri karte,
  // prelazimo na sljedećeg igrača.
  if (updatedTrick.length < 4) {
    return {
      ...state,
      players: updatedPlayers,
      currentTrick: updatedTrick,
      currentPlayerNumber: getNextPlayer(playerNumber),
      team1Bela: belaTeam1,
      team2Bela: belaTeam2,
      belaAnnouncedBy,
    };
  }

  // Određujemo pobjednika završenog štiha.
  const winningPlayedCard = getTrickWinner(updatedTrick, state.trumpSuit);

  const winningTeam =
    winningPlayedCard.playerNumber === 1 || winningPlayedCard.playerNumber === 3
      ? 1
      : 2;

  // Provjeravamo je li ovo posljednji, osmi štih.
  const isLastTrick = state.completedTricks === 7;

  // Izračunavamo bodove svih karata u štihu.
  const trickPoints = getTrickPoints(
    updatedTrick,
    state.trumpSuit,
    isLastTrick,
  );

  // Dodjeljujemo bodove ekipi koja je osvojila štih.
  const team1TrickPoints =
    state.team1TrickPoints + (winningTeam === 1 ? trickPoints : 0);

  const team2TrickPoints =
    state.team2TrickPoints + (winningTeam === 2 ? trickPoints : 0);

  // Povećavamo broj osvojenih štihova odgovarajuće ekipe.
  const team1TricksWon = state.team1TricksWon + (winningTeam === 1 ? 1 : 0);

  const team2TricksWon = state.team2TricksWon + (winningTeam === 2 ? 1 : 0);

  // Izračunavamo konačni rezultat nakon posljednjeg štiha.
  let finalScore: FinalGameResult | null = null;

  if (isLastTrick) {
    if (state.callingTeam === null) {
      throw new Error("Ekipa koja je zvala adut nije određena.");
    }

    // Pripremamo zvanja i bodove bele za završni obračun.
    const declarations = createGameDeclarations(
      state.declarationResult,
      belaTeam1,
      belaTeam2,
    );

    // Konačni rezultat uključuje štihove, zvanja i belu.
    finalScore = calculateFinalScore(
      {
        team1: team1TrickPoints,
        team2: team2TrickPoints,
      },
      state.callingTeam,
      declarations,
    );
  }
  // Kod DOSTA rezultat se provjerava nakon svakog zavrsenog stiha.
  // Zvanja i bela se pribrajaju jednom, kao dio trenutnog dijeljenja.
  const dostaTeam1 = state.team1MatchScore + team1TrickPoints + state.team1DeclaredPoints + belaTeam1;
  const dostaTeam2 = state.team2MatchScore + team2TrickPoints + state.team2DeclaredPoints + belaTeam2;
  const dostaWinner = checkDostaWinner(state.matchSettings, dostaTeam1, dostaTeam2);

  // Kod PROLAZ rezultat se upisuje tek nakon posljednjeg stiha.
  // Kod DOSTA koji zavrsi ranije spremamo trenutne bodove bez dupliranja.
  const team1MatchScore = dostaWinner !== null && !isLastTrick
    ? dostaTeam1 : state.team1MatchScore + (finalScore?.team1 ?? 0);
  const team2MatchScore = dostaWinner !== null && !isLastTrick
    ? dostaTeam2 : state.team2MatchScore + (finalScore?.team2 ?? 0);

  // Dodajemo rezultat u povijest samo kada je runda završena.
  const roundHistory = finalScore
    ? [
        ...state.roundHistory,
        {
          roundNumber: state.roundNumber,
          team1: finalScore.team1,
          team2: finalScore.team2,
        },
      ]
    : state.roundHistory;

  // DOSTA moze zavrsiti prije osmog stiha, PROLAZ iskljucivo na kraju.
  const matchWinnerTeam = dostaWinner ?? (isLastTrick
    ? checkProlazWinner(state.matchSettings, team1MatchScore, team2MatchScore)
    : null);

  // Vraćamo ažurirano stanje nakon završenog štiha.
  return {
    ...state,
    players: updatedPlayers,
    currentTrick: [],
    completedTricks: state.completedTricks + 1,
    team1TrickPoints,
    team2TrickPoints,
    team1TricksWon,
    team2TricksWon,
    team1Bela: belaTeam1,
    team2Bela: belaTeam2,
    belaAnnouncedBy,
    team1MatchScore,
    team2MatchScore,
    roundHistory,
    matchWinnerTeam,
    currentPlayerNumber: winningPlayedCard.playerNumber,
    phase: matchWinnerTeam !== null ? "finished" : isLastTrick ? "round_finished" : "playing",
    finalScore,
  };
}
