import type {
  BelotCard,
  BelotSuit,
  PlayedCard,
} from "../components/game/GameTable";

export type ClientGamePlayer = {
  playerNumber: 1 | 2 | 3 | 4;
  socketId: string;
  username: string;
  team: 1 | 2;
  hand: BelotCard[];
  isDealer: boolean;
};

export type ClientGameState = {
  roomCode: string;
  players: ClientGamePlayer[];
  phase:
    | "dealing"
    | "trump_call"
    | "dealing_remaining"
    | "declarations"
    | "playing"
    | "round_finished"
    | "finished";
  trumpSuit: BelotSuit | null;
  trumpTurnPlayerNumber: 1 | 2 | 3 | 4;
  declarationTurnPlayerNumber: 1 | 2 | 3 | 4 | null;
  completedDeclarationPlayers: number[];
  roundNumber: number;
  dealerPlayerNumber: 1 | 2 | 3 | 4;
  team1MatchScore: number;
  team2MatchScore: number;
  matchWinnerTeam: 1 | 2 | null;
  team1DeclaredPoints: number;
  team2DeclaredPoints: number;
  activeDeclaration: {
    playerNumber: 1 | 2 | 3 | 4;
    cards: BelotCard[];
    points: number;
  } | null;
  finalScore: {
    team1: number;
    team2: number;
    winningTeam: 1 | 2 | null;
    declarationPoints: number;
  } | null;
  currentPlayerNumber: number;
  currentTrick: PlayedCard[];
  team1TrickPoints: number;
  team2TrickPoints: number;
  myHand: BelotCard[];
};

export type User = {
  id: number;
  username: string;
  email: string;
};

export type AuthResponse = {
  success?: boolean;
  message?: string;
  sessionToken?: string;
  user?: User;
};

export type Mode = "login" | "register";

export type Player = {
  id: string;
  userId: number;
  username: string;
  isHost: boolean;
  rating: number;
  seat: 1 | 2 | 3 | 4;
};

export type Room = {
  code: string;
  players: Player[];
  maxPlayers: 4;
  status: "waiting" | "playing";
  createdAt: string;
  isPublic: boolean;
  minRating: number;
  turnDuration: 15 | 30 | 45;
  gameType: "prolaz" | "dosta";
  targetScore: 501 | 701 | 1001;
};

export type RoomResponse = {
  success: boolean;
  message?: string;
  room?: Room;
  rooms?: Room[];
};

export type { BelotCard, BelotSuit, PlayedCard };
