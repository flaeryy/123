"use client";

import GameTable from "./GameTable";
import type {
  BelotCard,
  BelotSuit,
  ClientGameState,
} from "../../types/belot";

import HungarianCard from "./HungarianCard";

type ActiveGameProps = {
  gameState: ClientGameState | null;
  socketId: string;
  onPlayCard: (card: BelotCard) => void;
  onChooseTrump: (suit: BelotSuit) => void;
  onPassTrump: () => void;
};

export default function ActiveGame({
  gameState,
  socketId,
  onPlayCard,
  onChooseTrump,
  onPassTrump,
}: ActiveGameProps) {
  if (!gameState) {
    return (
      <div className="lobby-section">
        <h3>Partija se učitava...</h3>
      </div>
    );
  }

  return (
    <GameTable
      players={gameState.players.map((player) => ({
        id: player.socketId,
        username: player.username,
        seat: (player.playerNumber - 1) as 0 | 1 | 2 | 3,
      }))}
      hand={gameState.myHand}
      playedCards={gameState.currentTrick}
      currentPlayerId={
        gameState.players.find(
          (player) => player.playerNumber === gameState.currentPlayerNumber,
        )?.socketId ?? null
      }
      viewerId={socketId}
      trump={gameState.trumpSuit}
      team1Score={gameState.team1TrickPoints}
      team2Score={gameState.team2TrickPoints}
      phase={gameState.phase}
      canPlay={
        gameState.phase === "playing" &&
        gameState.players.some(
          (player) =>
            player.socketId === socketId &&
            player.playerNumber === gameState.currentPlayerNumber,
        )
      }
      canChooseTrump={
        gameState.phase === "trump_call" &&
        gameState.players.some(
          (player) =>
            player.socketId === socketId &&
            player.playerNumber === gameState.trumpTurnPlayerNumber,
        )
      }
      trumpTurnPlayerNumber={gameState.trumpTurnPlayerNumber}
      onPlayCard={onPlayCard}
      onChooseTrump={onChooseTrump}
      onPassTrump={onPassTrump}
    />
  );
}
