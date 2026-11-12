"use client";

import HungarianCard from "./HungarianCard";

export type BelotSuit = "hearts" | "diamonds" | "clubs" | "spades";
export type BelotRank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export type BelotCard = {
  suit: BelotSuit;
  rank: BelotRank;
};

export type TablePlayer = {
  id: string;
  username: string;
  seat: 0 | 1 | 2 | 3;
};

export type PlayedCard = {
  playerNumber: number;
  card: BelotCard;
};

type GameTableProps = {
  players: TablePlayer[];
  hand: BelotCard[];
  playedCards: PlayedCard[];
  currentPlayerId: string | null;
  viewerId: string;
  trump: BelotSuit | null;
  team1Score: number;
  team2Score: number;
  canPlay?: boolean;
  phase: "dealing" | "trump_call" | "dealing_remaining" | "playing" | "finished";
  canChooseTrump?: boolean;
  trumpTurnPlayerNumber?: number;
  viewerPlayerNumber?: number;
  onPlayCard: (card: BelotCard) => void;
  onChooseTrump?: (suit: BelotSuit) => void;
  onPassTrump?: () => void;
};

const SUITS: Record<BelotSuit, { symbol: string; name: string; red: boolean }> = {
  hearts: { symbol: "♥", name: "Herc", red: true },
  diamonds: { symbol: "♦", name: "Karo", red: true },
  clubs: { symbol: "♣", name: "Tref", red: false },
  spades: { symbol: "♠", name: "Pik", red: false },
};

const SUIT_ORDER: BelotSuit[] = ["hearts", "diamonds", "clubs", "spades"];


function PlayingCard({
  card,
  onClick,
  disabled = false,
  small = false,
}: {
  card: BelotCard;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <div className={small ? "played-hungarian-card" : "hand-hungarian-card"}>
      <HungarianCard
        card={card}
        onClick={onClick}
        disabled={disabled}
      />
    </div>
  );
}


export default function GameTable({
  players,
  hand,
  playedCards,
  currentPlayerId,
  viewerId,
  trump,
  team1Score,
  team2Score,
  canPlay = false,
  phase,
  canChooseTrump = false,
  trumpTurnPlayerNumber,
  viewerPlayerNumber,
  onPlayCard,
  onChooseTrump,
  onPassTrump,
}: GameTableProps) {
  const positions = ["bottom", "left", "top", "right"] as const;
  const viewer = players.find((player) => player.id === viewerId);
  const viewerSeat = viewer?.seat ?? 0;

  const sortedPlayers = [...players].sort((a, b) => {
    const aPosition = (a.seat - viewerSeat + 4) % 4;
    const bPosition = (b.seat - viewerSeat + 4) % 4;
    return aPosition - bPosition;
  });

  const playerByNumber = (playerNumber: number) =>
    players.find((player) => player.seat + 1 === playerNumber);

  return (
    <main className="belot-game">
      <header className="belot-header">
        <div>
          <div className="belot-brand">BELOT</div>
          <div className="belot-subtitle">Klasična kartaška igra</div>
        </div>

        <div className="belot-score">
          <div>
            <span>Naša ekipa</span>
            <strong>{team1Score}</strong>
          </div>
          <div className="score-divider" />
          <div>
            <span>Protivnici</span>
            <strong>{team2Score}</strong>
          </div>
        </div>
      </header>

      <section className="belot-table">
        <div className="table-decoration" />

        {sortedPlayers.map((player, index) => {
          const position = positions[index];
          const isCurrent = player.id === currentPlayerId;
          const isMe = player.id === viewerId;

          return (
            <div
              key={player.id}
              className={`table-player player-${position} ${
                isCurrent ? "active-player" : ""
              }`}
            >
              <div className="player-avatar">
                {player.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="player-info">
                <strong>{player.username}</strong>
                <span>
                  {isMe ? "Ti" : isCurrent ? "Na potezu" : "Igrač"}
                </span>
              </div>
              {isCurrent && <span className="turn-indicator">●</span>}
            </div>
          );
        })}

        <div className="trump-indicator">
          <span>ADUT</span>
          <strong>
            {trump ? (
              <span className={SUITS[trump].red ? "red-suit" : "black-suit"}>
                {SUITS[trump].symbol} {SUITS[trump].name}
              </span>
            ) : (
              "Još nije određen"
            )}
          </strong>
        </div>

        <div className="played-cards">
          {playedCards.map((played, index) => {
            const player = playerByNumber(played.playerNumber);

            return (
              <div
                className={`played-card played-card-${index}`}
                key={`${played.playerNumber}-${index}`}
              >
                <PlayingCard card={played.card} small />
                <span>{player?.username ?? `Igrač ${played.playerNumber}`}</span>
              </div>
            );
          })}

          {playedCards.length === 0 && (
            <div className="empty-table-message">Čeka se prva karta...</div>
          )}
        </div>
      </section>

      {phase === "trump_call" && (
        <section className="trump-controls">
          <strong>
            {canChooseTrump
              ? "Odaberi adut ili prođi"
              : `Čeka se odabir igrača ${trumpTurnPlayerNumber ?? ""}`}
          </strong>

          <div className="trump-buttons">
            {SUIT_ORDER.map((suit) => (
              <button
                type="button"
                key={suit}
                disabled={!canChooseTrump}
                onClick={() => onChooseTrump?.(suit)}
                className={SUITS[suit].red ? "red-suit" : "black-suit"}
              >
                {SUITS[suit].symbol} {SUITS[suit].name}
              </button>
            ))}

            <button
              type="button"
              className="pass-trump-button"
              disabled={!canChooseTrump}
              onClick={onPassTrump}
            >
              Prođi
            </button>
          </div>
        </section>
      )}

      {phase === "finished" && (
        <div className="game-finished-message">
          Dijeljenje je završeno.
        </div>
      )}

      <footer className="belot-hand-area">
        <div className="hand-heading">
          <div>
            <strong>Tvoje karte</strong>
            <span>{hand.length} karata u ruci</span>
          </div>
          <span className="hand-hint">
            {canPlay ? "Odaberi kartu za igranje" : "Čeka se tvoj potez"}
          </span>
        </div>

        <div className="belot-hand">
          {hand.map((card, index) => (
            <PlayingCard
              key={`${card.suit}-${card.rank}-${index}`}
              card={card}
              disabled={!canPlay}
              onClick={() => onPlayCard(card)}
            />
          ))}
        </div>
      </footer>
    </main>
  );
}
