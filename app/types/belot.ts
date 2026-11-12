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
  phase: "dealing" | "trump_call" | "dealing_remaining" | "playing" | "finished";
  trumpSuit: BelotSuit | null;
  trumpTurnPlayerNumber: 1 | 2 | 3 | 4;
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
};

export type Room = {
  code: string;
  players: Player[];
  maxPlayers: 4;
  status: "waiting" | "playing";
  createdAt: string;
  isPublic: boolean;
  minRating: number;
};

export type RoomResponse = {
  success: boolean;
  message?: string;
  room?: Room;
  rooms?: Room[];
};

export type { BelotCard, BelotSuit, PlayedCard };
