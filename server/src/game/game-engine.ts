
import type { Card, Suit } from "./cards.js";
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

// Faze kroz koje prolazi jedna partija.
export type GamePhase =
    | "dealing"
    | "trump_call"
    | "dealing_remaining"
    | "playing"
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
    players: GamePlayer[];
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
    startPlayerNumber: 1 | 2 | 3 | 4
): GameState {
    if (players.length !== 4) {
        throw new Error("Za Belot su potrebna točno 4 igrača.");
    }

    const deck = shuffleDeck(createDeck());
    const initialDeal = dealInitialCards(deck);

    const gamePlayers: GamePlayer[] = players.map((player, index) => ({
        playerNumber: (index + 1) as 1 | 2 | 3 | 4,
        socketId: player.socketId,
        username: player.username,
        team: index % 2 === 0 ? 1 : 2,
        hand: initialDeal.hands[index],
        isDealer: index === 3,
    }));

    return {
        roomCode,
        players: gamePlayers,
        declarationHands: initialDeal.hands.map((hand) => [...hand]),
        phase: "trump_call",
        remainingCards: initialDeal.remainingCards,
        trumpSuit: null,
        trumpCallerPlayerNumber: null,
        callingTeam: null,
        trumpTurnPlayerNumber: 1,
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

    if (currentPlayer === 4) {
        throw new Error("Djelitelj mora odabrati adut.");
    }

    return {
        ...state,
        trumpTurnPlayerNumber: (currentPlayer + 1) as 1 | 2 | 3 | 4,
    };
}

// Igrač odabire boju aduta.
export function chooseTrump(
    state: GameState,
    playerNumber: 1 | 2 | 3 | 4,
    trumpSuit: Suit
): GameState {
    if (state.phase !== "trump_call") {
        throw new Error("Trenutno nije faza biranja aduta.");
    }

    if (state.trumpTurnPlayerNumber !== playerNumber) {
        throw new Error("Nisi ti na redu za biranje aduta.");
    }

    if (playerNumber === 4 && !trumpSuit) {
        throw new Error("Djelitelj mora odabrati adut.");
    }

    const completedDeal = dealRemainingCards({
        hands: state.players.map((player) => player.hand),
        remainingCards: state.remainingCards,
    });

    const sequences = completedDeal.players.flatMap((player, index) =>
  findSequences(player.cards, index + 1)
);

const fourOfAKinds = completedDeal.players.flatMap((player, index) =>
  findFourOfAKinds(player.cards, index + 1)
);

const declarationResult = compareAllDeclarations(
  sequences,
  fourOfAKinds,
  1,
);

    const updatedPlayers = state.players.map((player, index) => ({
        ...player,
        hand: completedDeal.players[index].cards,
    }));

    return {
        ...state,
        players: updatedPlayers,
        declarationHands: completedDeal.players.map((player) => [
            ...player.cards,
        ]),
        phase: "playing",
        remainingCards: [],
        trumpSuit,
        trumpCallerPlayerNumber: playerNumber,
        callingTeam: playerNumber === 1 || playerNumber === 3 ? 1 : 2,
        currentPlayerNumber: 1,
        declarationResult
    };
}

// Vraća sljedećeg igrača u smjeru kazaljke na satu.
function getNextPlayer(
    playerNumber: 1 | 2 | 3 | 4
): 1 | 2 | 3 | 4 {
    return ((playerNumber % 4) + 1) as 1 | 2 | 3 | 4;
}

// Igrač odigrava kartu i po potrebi najavljuje belu.
export function playCard(
    state: GameState,
    playerNumber: 1 | 2 | 3 | 4,
    card: Card,
    announceBela = false
): GameState {
    if (state.phase !== "playing") {
        throw new Error("Partija trenutno nije u fazi igranja.");
    }

    if (state.currentPlayerNumber !== playerNumber) {
        throw new Error("Nisi ti na potezu.");
    }

    const player = state.players.find(
        (p) => p.playerNumber === playerNumber
    );

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
        state.currentTrick
    );

    const isLegal = legalCards.some(
        (legalCard) =>
            legalCard.suit === card.suit &&
            legalCard.rank === card.rank
    );

    if (!isLegal) {
        throw new Error("Ta karta nije dozvoljena.");
    }

    // Provjeravamo je li odigran kralj ili dama aduta.
    const isTrumpKingOrQueen =
        card.suit === state.trumpSuit &&
        (card.rank === "K" || card.rank === "Q");

    // Provjeravamo ima li igrač kralja i damu aduta.
    const playerHasBela = hasBela(player.hand, state.trumpSuit);

    const mustAnnounceBela =
        isTrumpKingOrQueen && playerHasBela;

    // Bela se može najaviti samo jednom u partiji.
    if (mustAnnounceBela && state.belaAnnouncedBy !== null) {
        throw new Error("Bela je već najavljena u ovoj partiji.");
    }

    if (mustAnnounceBela && !announceBela) {
        throw new Error(
            "Moraš najaviti belu kada odigraš kralja ili damu aduta."
        );
    }

    if (announceBela && !mustAnnounceBela) {
        throw new Error("Nemaš pravo najaviti belu.");
    }

    // Dodjeljujemo 20 bodova ekipi koja je najavila belu.
    const belaTeam1 =
        state.team1Bela + (announceBela && player.team === 1 ? 20 : 0);

    const belaTeam2 =
        state.team2Bela + (announceBela && player.team === 2 ? 20 : 0);

    const belaAnnouncedBy = announceBela
        ? playerNumber
        : state.belaAnnouncedBy;

    // Uklanjamo odigranu kartu iz ruke igrača.
    const updatedPlayers = state.players.map((p) =>
        p.playerNumber === playerNumber
            ? {
                ...p,
                hand: p.hand.filter(
                    (c) => !(c.suit === card.suit && c.rank === card.rank)
                ),
            }
            : p
    );

    // Dodajemo odigranu kartu u trenutačni štih.
    const updatedTrick = [
        ...state.currentTrick,
        { playerNumber, card },
    ];

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
    const winningPlayedCard = getTrickWinner(
        updatedTrick,
        state.trumpSuit
    );

    const winningTeam =
        winningPlayedCard.playerNumber === 1 ||
            winningPlayedCard.playerNumber === 3
            ? 1
            : 2;

    // Provjeravamo je li ovo posljednji, osmi štih.
    const isLastTrick = state.completedTricks === 7;

    // Izračunavamo bodove svih karata u štihu.
    const trickPoints = getTrickPoints(
        updatedTrick,
        state.trumpSuit,
        isLastTrick
    );

    // Dodjeljujemo bodove ekipi koja je osvojila štih.
    const team1TrickPoints =
        state.team1TrickPoints +
        (winningTeam === 1 ? trickPoints : 0);

    const team2TrickPoints =
        state.team2TrickPoints +
        (winningTeam === 2 ? trickPoints : 0);

    // Povećavamo broj osvojenih štihova odgovarajuće ekipe.
    const team1TricksWon =
        state.team1TricksWon + (winningTeam === 1 ? 1 : 0);

    const team2TricksWon =
        state.team2TricksWon + (winningTeam === 2 ? 1 : 0);


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
            belaTeam2
        );

        // Konačni rezultat uključuje štihove, zvanja i belu.
        finalScore = calculateFinalScore(
            {
                team1: team1TrickPoints,
                team2: team2TrickPoints,
            },
            state.callingTeam,
            declarations
        );
    }
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
        currentPlayerNumber: winningPlayedCard.playerNumber,
        phase: isLastTrick ? "finished" : "playing",
        finalScore,
    };
}
