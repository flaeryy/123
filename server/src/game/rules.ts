import type { Card, Rank, Suit } from "./cards.js";

const allSuits: Suit[] = [
  "hearts",
  "diamonds",
  "clubs",
  "spades",
];

export const trumpStrength: Record<Rank, number> = {
  J: 8,
  "9": 7,
  A: 6,
  "10": 5,
  K: 4,
  Q: 3,
  "8": 2,
  "7": 1,
};

export const normalStrength: Record<Rank, number> = {
  A: 8,
  "10": 7,
  K: 6,
  Q: 5,
  J: 4,
  "9": 3,
  "8": 2,
  "7": 1,
};

export const trumpPoints: Record<Rank, number> = {
  J: 20,
  "9": 14,
  A: 11,
  "10": 10,
  K: 4,
  Q: 3,
  "8": 0,
  "7": 0,
};

export const normalPoints: Record<Rank, number> = {
  A: 11,
  "10": 10,
  K: 4,
  Q: 3,
  J: 2,
  "9": 0,
  "8": 0,
  "7": 0,
};


export function getLegalCards(
  hand: Card[],
  leadSuit: Suit | null,
  trumpSuit: Suit,
  playedCards: PlayedCard[] = [],
): Card[] {
  // Na početku štiha igrač može odigrati bilo koju kartu.
  if (leadSuit === null) {
    return hand;
  }
  // Provjeravamo je li netko već presjekao adutom.
  const trumpAlreadyPlayed = playedCards.some(
    (played) => played.card.suit === trumpSuit,
  );

  // Provjeravamo imamo li traženu boju.
  const cardsOfLeadSuit = hand.filter(
    (card) => card.suit === leadSuit,
  );

  if (cardsOfLeadSuit.length > 0) {
    // Ako je druga boja već presječena adutom,
    // ne moramo nadjačavati početnu boju.
    if (leadSuit !== trumpSuit && trumpAlreadyPlayed) {
      return cardsOfLeadSuit;
    }

    // Tražimo najjaču kartu početne boje u štihu.
    const strength = leadSuit === trumpSuit
      ? trumpStrength
      : normalStrength;

    const playedOfLeadSuit = playedCards.filter(
      (played) => played.card.suit === leadSuit,
    );

    const strongestPlayed = Math.max(
      ...playedOfLeadSuit.map(
        (played) => strength[played.card.rank],
      ),
    );

    // Ako imamo jaču kartu, moramo je baciti.
    const strongerCards = cardsOfLeadSuit.filter(
      (card) => strength[card.rank] > strongestPlayed,
    );

    return strongerCards.length > 0
      ? strongerCards
      : cardsOfLeadSuit;
  }

  // Nemamo traženu boju pa provjeravamo adute.
  const trumps = hand.filter(
    (card) => card.suit === trumpSuit,
  );

  if (trumps.length === 0) {
    // Nemamo ni traženu boju ni adut.
    return hand;
  }

  if (!trumpAlreadyPlayed) {
    // Nitko još nije presjekao: moramo baciti adut.
    return trumps;
  }

  // Adut je već bačen: tražimo jači adut.
  const strongestTrumpPlayed = Math.max(
    ...playedCards
      .filter((played) => played.card.suit === trumpSuit)
      .map((played) => trumpStrength[played.card.rank]),
  );

  const strongerTrumps = trumps.filter(
    (card) => trumpStrength[card.rank] > strongestTrumpPlayed,
  );

  // Ako imamo jači adut, moramo ga baciti.
  // Ako nemamo, možemo baciti bilo koji svoj adut.
  return strongerTrumps.length > 0
    ? strongerTrumps
    : trumps;
}

export function isLegalMove(
  hand: Card[],
  selectedCard: Card,
  leadSuit: Suit,
  trumpSuit: Suit,
  playedCards: PlayedCard[] = [],
): boolean {
  const legalCards = getLegalCards(
    hand,
    leadSuit,
    trumpSuit,
    playedCards,
  );

  return legalCards.some(
    (card) =>
      card.suit === selectedCard.suit &&
      card.rank === selectedCard.rank,
  );
}
export type PlayedCard = {
  playerNumber: number;
  card: Card;
};

export function getTrickWinner(
  playedCards: PlayedCard[],
  trumpSuit: Suit,
): PlayedCard {
  if (playedCards.length !== 4) {
    throw new Error("Štih mora sadržavati točno 4 karte.");
  }

  const leadSuit = playedCards[0].card.suit;

  let winningCard = playedCards[0];

  for (const played of playedCards.slice(1)) {
    const currentCard = played.card;
    const winning = winningCard.card;

    const currentIsTrump = currentCard.suit === trumpSuit;
    const winningIsTrump = winning.suit === trumpSuit;

    if (currentIsTrump && !winningIsTrump) {
      winningCard = played;
      continue;
    }

    if (!currentIsTrump && winningIsTrump) {
      continue;
    }

    if (currentIsTrump && winningIsTrump) {
      if (
        trumpStrength[currentCard.rank] >
        trumpStrength[winning.rank]
      ) {
        winningCard = played;
      }

      continue;
    }

    const currentFollowsLead = currentCard.suit === leadSuit;
    const winningFollowsLead = winning.suit === leadSuit;

    if (
      currentFollowsLead &&
      winningFollowsLead &&
      normalStrength[currentCard.rank] >
        normalStrength[winning.rank]
    ) {
      winningCard = played;
    }
  }

  return winningCard;
}

// Izračunava ukupan broj bodova osvojenih u jednom štihu.
// Ako je riječ o zadnjem štihu, dodaje dodatnih 10 bodova.
export function getTrickPoints(
  playedCards: PlayedCard[],
  trumpSuit: Suit,
  isLastTrick = false,
): number {
  if (playedCards.length !== 4) {
    throw new Error("Štih mora sadržavati točno 4 karte.");
  }

  let points = 0;

  // Zbrajamo bodove svake odigrane karte.
  for (const played of playedCards) {
    const card = played.card;

    // Adut ima posebne vrijednosti bodova.
    if (card.suit === trumpSuit) {
      points += trumpPoints[card.rank];
    } else {
      // Karte koje nisu adut koriste normalne vrijednosti.
      points += normalPoints[card.rank];
    }
  }

  // Zadnji osvojeni štih donosi dodatnih 10 bodova.
  if (isLastTrick) {
    points += 10;
  }

  return points;
}

// Određuje kojoj ekipi pripada igrač.
// Igrači 1 i 3 su ekipa 1, a igrači 2 i 4 ekipa 2.
export function getPlayerTeam(playerNumber: number): 1 | 2 {
  if (![1, 2, 3, 4].includes(playerNumber)) {
    throw new Error("Neispravan broj igrača.");
  }

  // Neparni igrači pripadaju prvoj ekipi.
  return playerNumber % 2 === 1 ? 1 : 2;
}

// Rezultat jednog osvojenog štiha.
export type TrickResult = {
  winner: PlayedCard;
  winningTeam: 1 | 2;
  points: number;
};

// Određuje pobjednika štiha, njegovu ekipu i osvojene bodove.
export function calculateTrickResult(
  playedCards: PlayedCard[],
  trumpSuit: Suit,
  isLastTrick = false,
): TrickResult {
  // Pronalazimo kartu koja je osvojila štih.
  const winner = getTrickWinner(playedCards, trumpSuit);

  // Određujemo kojoj ekipi pripada pobjednik.
  const winningTeam = getPlayerTeam(winner.playerNumber);

  // Izračunavamo bodove svih karata u štihu.
  const points = getTrickPoints(
    playedCards,
    trumpSuit,
    isLastTrick,
  );

  return {
    winner,
    winningTeam,
    points,
  };
}
// Rezultat obje ekipe tijekom jedne partije.
export type TeamScores = {
  team1: number;
  team2: number;
};

// Stvara početni rezultat partije.
// Obje ekipe počinju s nula bodova.
export function createTeamScores(): TeamScores {
  return {
    team1: 0,
    team2: 0,
  };
}

// Dodaje bodove ekipi koja je osvojila štih.
// Vraća novi rezultat bez mijenjanja postojećeg objekta.
export function addTrickPoints(
  scores: TeamScores,
  trickResult: TrickResult,
): TeamScores {
  // Kopiramo postojeći rezultat.
  const updatedScores = { ...scores };

  // Bodove dodajemo ekipi koja je osvojila štih.
  if (trickResult.winningTeam === 1) {
    updatedScores.team1 += trickResult.points;
  } else {
    updatedScores.team2 += trickResult.points;
  }

  return updatedScores;
}

// Provjerava je li partija završila.
// U Belotu se igra ukupno 8 štihova jer svaki igrač ima 8 karata.
export function isGameFinished(completedTricks: number): boolean {
  // Broj štihova mora biti cijeli broj između 0 i 8.
  if (
    !Number.isInteger(completedTricks) ||
    completedTricks < 0 ||
    completedTricks > 8
  ) {
    throw new Error("Broj završenih štihova mora biti između 0 i 8.");
  }

  // Partija je završena kada je odigrano svih 8 štihova.
  return completedTricks === 8;
}


// Konačni rezultat partije.
export type FinalGameResult = {
  team1: number;
  team2: number;
  winningTeam: 1 | 2 | null;
  contractMade: boolean;

  // Bodovi običnih zvanja koje je osvojila ekipa.
  declarationPoints: number;

  // Bodovi bele za svaku ekipu.
  team1Bela: number;
  team2Bela: number;
};


// Izračunava konačni rezultat nakon svih osam štihova,
// uključujući zvanja i belu.
export function calculateFinalScore(
  scores: TeamScores,
  callingTeam: 1 | 2,
  declarations: GameDeclarations,
): FinalGameResult {
  // Provjeravamo je li ekipa koja je zvala adut osvojila više bodova.
  const contractMade =
    callingTeam === 1
      ? scores.team1 > scores.team2
      : scores.team2 > scores.team1;

  // Početni bodovi zvanja i bele za obje ekipe.
  let team1Declarations = 0;
  let team2Declarations = 0;

  // Obična zvanja pripadaju samo ekipi koja je pobijedila u usporedbi.
  if (declarations.winningTeam === 1) {
    team1Declarations = declarations.points;
  } else if (declarations.winningTeam === 2) {
    team2Declarations = declarations.points;
  }

  // Bela se zasebno dodaje ekipi koja ju je ostvarila.
  let team1Bela = declarations.team1Bela;
  let team2Bela = declarations.team2Bela;

  // Ako ekipa koja je zvala adut padne, protivnici dobivaju:
  // svih 162 osnovnih bodova, njezina zvanja i njezinu belu.
  if (!contractMade) {
    if (callingTeam === 1) {
      team2Declarations += team1Declarations;
      team1Declarations = 0;

      team2Bela += team1Bela;
      team1Bela = 0;

      return {
        team1: 0,
        team2: 162 + team2Declarations + team2Bela,
        winningTeam: 2,
        contractMade: false,
        declarationPoints: team2Declarations,
        team1Bela,
        team2Bela,
      };
    }

    team1Declarations += team2Declarations;
    team2Declarations = 0;

    team1Bela += team2Bela;
    team2Bela = 0;

    return {
      team1: 162 + team1Declarations + team1Bela,
      team2: 0,
      winningTeam: 1,
      contractMade: false,
      declarationPoints: team1Declarations,
      team1Bela,
      team2Bela,
    };
  }

  // Ako je ekipa prošla, svaka ekipa zadržava svoje osvojene bodove.
  return {
    team1: scores.team1 + team1Declarations + team1Bela,
    team2: scores.team2 + team2Declarations + team2Bela,
    winningTeam: callingTeam,
    contractMade: true,
    declarationPoints: team1Declarations + team2Declarations,
    team1Bela,
    team2Bela,
  };
}


// Provjerava ima li igrač Belu (kralja i damu u adutu).
// Bela vrijedi 20 dodatnih bodova.
export function hasBela(
  hand: Card[],
  trumpSuit: Suit,
): boolean {
  // Provjeravamo ima li igrač kralja i damu u adutu.
  const hasKing = hand.some(
    (card) => card.suit === trumpSuit && card.rank === "K",
  );

  const hasQueen = hand.some(
    (card) => card.suit === trumpSuit && card.rank === "Q",
  );

  // Bela postoji samo ako igrač ima obje karte.
  return hasKing && hasQueen;
}
// Redoslijed karata za prepoznavanje uzastopnih nizova.
const sequenceOrder: Rank[] = [
  "7", "8", "9", "10", "J", "Q", "K", "A",
];

// Podaci o pronađenom nizu karata.
export type SequenceDeclaration = {
  playerNumber: number;
  suit: Suit;
  length: number;
  points: number;
  highestRank: Rank;
  highestRankStrength: number;
};

export type FourOfAKindDeclaration = {
  playerNumber: number;
  rank: Rank;
  points: number;
  strength: number;
};

const fourOfAKindStrength: Partial<Record<Rank, number>> = {
  J: 6,
  "9": 5,
  A: 4,
  "10": 3,
  K: 2,
  Q: 1,
};


// Pronalazi sva zvanja četiriju istih karata u ruci jednog igrača.
export function findFourOfAKinds(
  hand: Card[],
  playerNumber: number,
): FourOfAKindDeclaration[] {
  // Provjeravamo je li broj igrača valjan.
  if (![1, 2, 3, 4].includes(playerNumber)) {
    throw new Error("Neispravan broj igrača.");
  }

  // Brojimo koliko se puta pojavljuje svaki rang karte.
  const rankCounts = new Map<Rank, number>();

  for (const card of hand) {
    rankCounts.set(
      card.rank,
      (rankCounts.get(card.rank) ?? 0) + 1,
    );
  }

  // Ovdje ćemo spremiti sva pronađena zvanja.
  const declarations: FourOfAKindDeclaration[] = [];

  // Provjeravamo svaki rang karata.
  for (const [rank, count] of rankCounts) {
    const strength = fourOfAKindStrength[rank];

    // Četiri karte istog ranga predstavljaju valjano zvanje.
    if (count === 4 && strength !== undefined) {
      declarations.push({
        playerNumber,
        rank,
        points: getFourOfAKindPoints(
          hand.filter((card) => card.rank === rank),
        ),
        strength,
      });
    }
  }

  // Vraćamo sva pronađena zvanja, a ne samo najjače.
  return declarations;
}


// Pronalazi najjači niz uzastopnih karata u igračevim kartama.
// Vraća podatke o nizu kako bismo ga mogli usporediti s protivničkim.
export function findStrongestSequence(
  hand: Card[],
  playerNumber: number,
): SequenceDeclaration | null {

  // Čuvamo najjači pronađeni niz.
  let strongestSequence: SequenceDeclaration | null = null;

  // Provjeravamo svaku boju zasebno.
  for (const suit of allSuits) {
    const cardsInSuit = hand
      .filter((card) => card.suit === suit)
      .sort(
        (a, b) =>
          sequenceOrder.indexOf(a.rank) -
          sequenceOrder.indexOf(b.rank),
      );

    // Tražimo uzastopne karte iste boje.
    let currentSequence: Card[] = [];

    for (const card of cardsInSuit) {
      if (currentSequence.length === 0) {
        currentSequence.push(card);
        continue;
      }

      const previousCard = currentSequence[currentSequence.length - 1];

      const previousIndex = sequenceOrder.indexOf(previousCard.rank);
      const currentIndex = sequenceOrder.indexOf(card.rank);

      if (currentIndex === previousIndex + 1) {
        currentSequence.push(card);
      } else {
        // Provjeravamo završeni niz prije početka novog.
        if (currentSequence.length >= 3) {
          const highestCard = currentSequence[currentSequence.length - 1];

          const points =
            currentSequence.length >= 5
              ? 100
              : currentSequence.length === 4
                ? 50
                : 20;

          const declaration: SequenceDeclaration = {
            playerNumber,
            suit,
            length: currentSequence.length,
            points,
            highestRank: highestCard.rank,
            highestRankStrength: sequenceOrder.indexOf(highestCard.rank),
          };

          if (
            !strongestSequence ||
            declaration.length > strongestSequence.length ||
            (
              declaration.length === strongestSequence.length &&
              declaration.highestRankStrength >
                strongestSequence.highestRankStrength
            )
          ) {
            strongestSequence = declaration;
          }
        }

        currentSequence = [card];
      }
    }

    // Provjeravamo i niz koji završava zadnjom kartom u boji.
    if (currentSequence.length >= 3) {
      const highestCard = currentSequence[currentSequence.length - 1];

      const points =
        currentSequence.length >= 5
          ? 100
          : currentSequence.length === 4
            ? 50
            : 20;

      const declaration: SequenceDeclaration = {
        playerNumber,
        suit,
        length: currentSequence.length,
        points,
        highestRank: highestCard.rank,
        highestRankStrength: sequenceOrder.indexOf(highestCard.rank),
      };

      if (
        !strongestSequence ||
        declaration.length > strongestSequence.length ||
        (
          declaration.length === strongestSequence.length &&
          declaration.highestRankStrength >
            strongestSequence.highestRankStrength
        )
      ) {
        strongestSequence = declaration;
      }
    }
  }

  return strongestSequence;
}


// Pronalazi sve nizove od najmanje 3 uzastopne karte.
export function findSequences(
  hand: Card[],
  playerNumber: number,
): SequenceDeclaration[] {
  if (![1, 2, 3, 4].includes(playerNumber)) {
    throw new Error("Neispravan broj igrača.");
  }

  const sequences: SequenceDeclaration[] = [];

  for (const suit of allSuits) {
    const cardsInSuit = hand
      .filter((card) => card.suit === suit)
      .sort(
        (a, b) =>
          sequenceOrder.indexOf(a.rank) -
          sequenceOrder.indexOf(b.rank),
      );

    let currentSequence: Card[] = [];

    for (const card of cardsInSuit) {
      if (currentSequence.length === 0) {
        currentSequence.push(card);
        continue;
      }

      const previousCard =
        currentSequence[currentSequence.length - 1];

      const previousIndex = sequenceOrder.indexOf(previousCard.rank);
      const currentIndex = sequenceOrder.indexOf(card.rank);

      if (currentIndex === previousIndex + 1) {
        currentSequence.push(card);
      } else {
        if (currentSequence.length >= 3) {
          sequences.push(createSequenceDeclaration(
            currentSequence,
            playerNumber,
            suit,
          ));
        }

        currentSequence = [card];
      }
    }

    if (currentSequence.length >= 3) {
      sequences.push(createSequenceDeclaration(
        currentSequence,
        playerNumber,
        suit,
      ));
    }
  }

  return sequences;
}

// Pretvara pronađeni niz u podatke o zvanju.
function createSequenceDeclaration(
  cards: Card[],
  playerNumber: number,
  suit: Suit,
): SequenceDeclaration {
  const highestCard = cards[cards.length - 1];

  const points =
    cards.length >= 5
      ? 100
      : cards.length === 4
        ? 50
        : 20;

  return {
    playerNumber,
    suit,
    length: cards.length,
    points,
    highestRank: highestCard.rank,
    highestRankStrength: sequenceOrder.indexOf(highestCard.rank),
  };
}



// Rezultat usporedbe zvanja između dvije ekipe.
export type DeclarationResult = {
  winningTeam: 1 | 2;
  points: number;
  winningPlayer: number;
};


// Rezultat svih zvanja u jednoj igri.
// Obična zvanja pripadaju samo pobjedničkoj ekipi.
// Bela se vodi zasebno.
export type GameDeclarations = {
  winningTeam: 1 | 2 | null;
  points: number;
  team1Bela: number;
  team2Bela: number;
};



// Priprema konačne bodove zvanja za obje ekipe.
export function createGameDeclarations(
  declarationResult: DeclarationResult | null,
  team1Bela: number,
  team2Bela: number,
): GameDeclarations {
  // Provjeravamo da su bodovi bele valjani.
  if (team1Bela < 0 || team2Bela < 0) {
    throw new Error("Bodovi bele ne mogu biti negativni.");
  }

  // Ako nema običnih zvanja, nijedna ekipa ih ne dobiva.
  return {
    winningTeam: declarationResult?.winningTeam ?? null,
    points: declarationResult?.points ?? 0,
    team1Bela,
    team2Bela,
  };
}



function getTeamSequencePoints(
  declarations: SequenceDeclaration[],
  teamNumber: 1 | 2,
): number {
  return declarations
    .filter(
      (item) => getPlayerTeam(item.playerNumber) === teamNumber,
    )
    .reduce((total, item) => total + item.points, 0);
}


// Uspoređuje najjača zvanja obiju ekipa.
// Igrač koji prvi započinje prvi štih ima prednost kod jednakih zvanja.
export function compareTeamSequences(
  declarations: SequenceDeclaration[],
  firstPlayer: number,
): DeclarationResult | null {
  // Provjeravamo je li broj prvog igrača ispravan.
  if (![1, 2, 3, 4].includes(firstPlayer)) {
    throw new Error("Neispravan broj prvog igrača.");
  }

  // Pronalazimo najjače zvanje svake ekipe.
  const team1 = declarations
    .filter((item) => getPlayerTeam(item.playerNumber) === 1)
    .sort((a, b) =>
      b.length - a.length ||
      b.highestRankStrength - a.highestRankStrength,
    )[0];

  const team2 = declarations
    .filter((item) => getPlayerTeam(item.playerNumber) === 2)
    .sort((a, b) =>
      b.length - a.length ||
      b.highestRankStrength - a.highestRankStrength,
    )[0];

  // Ako nijedna ekipa nema zvanje, nema dodatnih bodova.
  if (!team1 && !team2) {
    return null;
  }

  // Ako samo jedna ekipa ima zvanje, ona dobiva bodove.
  if (team1 && !team2) {
    return {
      winningTeam: 1,
      points: getTeamSequencePoints(declarations, 1),
      winningPlayer: team1.playerNumber,
    };
  }

  if (team2 && !team1) {
    return {
      winningTeam: 2,
      points: getTeamSequencePoints(declarations, 2),
      winningPlayer: team2.playerNumber,
    };
  }

  // Uspoređujemo duljinu i najvišu kartu zvanja.
  const team1IsStronger =
    team1!.length > team2!.length ||
    (
      team1!.length === team2!.length &&
      team1!.highestRankStrength > team2!.highestRankStrength
    );

  const team2IsStronger =
    team2!.length > team1!.length ||
    (
      team2!.length === team1!.length &&
      team2!.highestRankStrength > team1!.highestRankStrength
    );

  // Ako je prvo zvanje jače, pobjeđuje ekipa 1.
  if (team1IsStronger) {
    return {
      winningTeam: 1,
      points: getTeamSequencePoints(declarations, 1),
      winningPlayer: team1!.playerNumber,
    };
  }

  // Ako je drugo zvanje jače, pobjeđuje ekipa 2.
  if (team2IsStronger) {
    return {
      winningTeam: 2,
    points: getTeamSequencePoints(declarations, 2),
      winningPlayer: team2!.playerNumber,
    };
  }

  // Ako su zvanja jednaka, prednost ima ekipa prvog igrača.
  const firstPlayerTeam = getPlayerTeam(firstPlayer);

  const winningDeclaration =
    firstPlayerTeam === 1 ? team1! : team2!;

  return {
    winningTeam: firstPlayerTeam,
    points: getTeamSequencePoints(declarations, firstPlayerTeam),
    winningPlayer: winningDeclaration.playerNumber,
  };
}



export function compareAllDeclarations(
  sequences: SequenceDeclaration[],
  fourOfAKind: FourOfAKindDeclaration[],
  firstPlayer: number,
): DeclarationResult | null {
  if (![1, 2, 3, 4].includes(firstPlayer)) {
    throw new Error("Neispravan broj prvog igrača.");
  }

  const team1Four = fourOfAKind
    .filter((item) => getPlayerTeam(item.playerNumber) === 1)
    .sort((a, b) => b.strength - a.strength)[0];

  const team2Four = fourOfAKind
    .filter((item) => getPlayerTeam(item.playerNumber) === 2)
    .sort((a, b) => b.strength - a.strength)[0];

  // Ako nema četiriju istih, uspoređujemo nizove.
  if (!team1Four && !team2Four) {
    return compareTeamSequences(sequences, firstPlayer);
  }

  let winningTeam: 1 | 2;
  let winningPlayer: number;

  if (team1Four && !team2Four) {
    winningTeam = 1;
    winningPlayer = team1Four.playerNumber;
  } else if (team2Four && !team1Four) {
    winningTeam = 2;
    winningPlayer = team2Four.playerNumber;
  } else if (team1Four!.strength > team2Four!.strength) {
    winningTeam = 1;
    winningPlayer = team1Four!.playerNumber;
  } else if (team2Four!.strength > team1Four!.strength) {
    winningTeam = 2;
    winningPlayer = team2Four!.playerNumber;
  } else {
    winningTeam = getPlayerTeam(firstPlayer);
    winningPlayer =
      winningTeam === 1
        ? team1Four!.playerNumber
        : team2Four!.playerNumber;
  }

  const sequencePoints = sequences
    .filter((item) => getPlayerTeam(item.playerNumber) === winningTeam)
    .reduce((total, item) => total + item.points, 0);

  const fourPoints = fourOfAKind
    .filter((item) => getPlayerTeam(item.playerNumber) === winningTeam)
    .reduce((total, item) => total + item.points, 0);

  return {
    winningTeam,
    points: sequencePoints + fourPoints,
    winningPlayer,
  };
}


// Određuje bodove za najdulji niz uzastopnih karata iste boje.
// Terce vrijedi 20, kvarta 50, a kvinta 100 bodova.
export function getSequencePoints(hand: Card[]): number {
  let highestSequence = 0;

  // Provjeravamo svaku boju zasebno.
  for (const suit of allSuits) {
    const ranksInSuit = hand
      .filter((card) => card.suit === suit)
      .map((card) => sequenceOrder.indexOf(card.rank))
      .sort((a, b) => a - b);

    // Brojimo uzastopne karte.
    let currentSequence = 1;

    for (let i = 1; i < ranksInSuit.length; i++) {
      if (ranksInSuit[i] === ranksInSuit[i - 1] + 1) {
        currentSequence++;
      } else if (ranksInSuit[i] !== ranksInSuit[i - 1]) {
        currentSequence = 1;
      }

      highestSequence = Math.max(
        highestSequence,
        currentSequence,
      );
    }
  }

  // Najdulji niz pretvaramo u odgovarajuće bodove.
  if (highestSequence >= 5) return 100;
  if (highestSequence === 4) return 50;
  if (highestSequence === 3) return 20;

  return 0;
}

// Provjerava ima li igrač četiri karte istog ranga.
// Četiri dečka vrijede 200, četiri devetke 150,
// a četiri asa, desetke, kralja i dame 100 bodova.
export function getFourOfAKindPoints(hand: Card[]): number {
  // Brojimo koliko igrač ima karata svakog ranga.
  const rankCounts: Record<Rank, number> = {
    "7": 0,
    "8": 0,
    "9": 0,
    "10": 0,
    J: 0,
    Q: 0,
    K: 0,
    A: 0,
  };

  // Povećavamo brojač za svaku kartu u ruci.
  for (const card of hand) {
    rankCounts[card.rank]++;
  }

  // Četiri dečka donose 200 bodova.
  if (rankCounts.J === 4) return 200;

  // Četiri devetke donose 150 bodova.
  if (rankCounts["9"] === 4) return 150;

  // Četiri asa, desetke, kralja ili dame donose 100 bodova.
  if (
    rankCounts.A === 4 ||
    rankCounts["10"] === 4 ||
    rankCounts.K === 4 ||
    rankCounts.Q === 4
  ) {
    return 100;
  }

  // Ako nema priznate kombinacije, nema dodatnih bodova.
  return 0;
}

// Sadrži sva zvanja koja je igrač ostvario u svojim kartama.
export type PlayerDeclarations = {
  bela: boolean;
  sequencePoints: number;
  fourOfAKindPoints: number;
  totalPoints: number;
};

// Prikuplja sva zvanja jednog igrača.
// Zasad samo prepoznaje kombinacije, bez odlučivanja koja ekipa dobiva zvanja.
export function calculatePlayerDeclarations(
  hand: Card[],
  trumpSuit: Suit,
): PlayerDeclarations {
  // Provjeravamo ima li igrač Belu.
  const bela = hasBela(hand, trumpSuit);

  // Provjeravamo najdulji niz uzastopnih karata.
  const sequencePoints = getSequencePoints(hand);

  // Provjeravamo četiri karte istog ranga.
  const fourOfAKindPoints = getFourOfAKindPoints(hand);

  // Zbrajamo bodove svih prepoznatih zvanja.
  // Bela donosi dodatnih 20 bodova.
  const totalPoints =
    (bela ? 20 : 0) +
    sequencePoints +
    fourOfAKindPoints;

  return {
    bela,
    sequencePoints,
    fourOfAKindPoints,
    totalPoints,
  };
}
