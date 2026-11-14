"use client";

import { useState } from "react";
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
  currentUserId?: number;
  messages?: Array<{
    id: number;
    roomCode: string;
    userId: number | null;
    username: string;
    message: string;
    createdAt: string | Date;
  }>;
  chatInput?: string;
  onChatInputChange?: (value: string) => void;
  onSendChat?: () => void;
  trump: BelotSuit | null;
  team1Score: number;
  team2Score: number;
  team1MatchScore?: number;
  team2MatchScore?: number;
  roundNumber?: number;
  matchWinnerTeam?: 1 | 2 | null;
  team1DeclarationPoints?: number;
  team2DeclarationPoints?: number;
  activeDeclaration?: {
    playerNumber: 1 | 2 | 3 | 4;
    cards: BelotCard[];
    points: number;
  } | null;
  finalScore?: {
    team1: number;
    team2: number;
    winningTeam: 1 | 2 | null;
    declarationPoints: number;
  } | null;
  canStartNextDeal?: boolean;
  nextDealLoading?: boolean;
  canPlay?: boolean;
  phase: "dealing" | "trump_call" | "dealing_remaining" | "declarations" | "playing" | "round_finished" | "finished";
  canChooseTrump?: boolean;
  canDeclare?: boolean;
  declarationTurnPlayerNumber?: number | null;
  completedDeclarationPlayers?: number[];
  trumpTurnPlayerNumber?: number;
  viewerPlayerNumber?: number;
  belaDecisionOpen?: boolean;
  pendingBelaCard?: BelotCard | null;
  onConfirmBela?: (announce: boolean) => void;
  onPlayCard: (card: BelotCard) => void;
  onChooseTrump?: (suit: BelotSuit) => void;
  onPassTrump?: () => void;
  onSubmitDeclarations?: (cards: BelotCard[]) => void;
  onStartNextDeal?: () => void;
};

const SUITS: Record<BelotSuit, { symbol: string; name: string; red: boolean; icon: string }> = {
  hearts: { symbol: "♥", name: "Herc", red: true, icon: "/cards/icons/heart-icon.png" },
  diamonds: { symbol: "♦", name: "Karo", red: true, icon: "/cards/icons/bell-icon.png" },
  clubs: { symbol: "♣", name: "Tref", red: false, icon: "/cards/icons/acorn-icon.png" },
  spades: { symbol: "♠", name: "Pik", red: false, icon: "/cards/icons/leaf-icon.png" },
};

const SUIT_ORDER: BelotSuit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANK_ORDER: BelotRank[] = ["7", "8", "9", "10", "J", "Q", "K", "A"];


function PlayingCard({
  card,
  onClick,
  disabled = false,
  small = false,
  selected = false,
}: {
  card: BelotCard;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  selected?: boolean;
}) {
  return (
    <div className={small ? "played-hungarian-card" : "hand-hungarian-card"}>
      <HungarianCard
        card={card}
        onClick={onClick}
        disabled={disabled}
        selected={selected}
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
  currentUserId,
  messages = [],
  chatInput = "",
  onChatInputChange,
  onSendChat,
  trump,
  team1Score,
  team2Score,
  team1MatchScore = team1Score,
  team2MatchScore = team2Score,
  roundNumber = 1,
  matchWinnerTeam = null,
  team1DeclarationPoints = 0,
  team2DeclarationPoints = 0,
  activeDeclaration = null,
  finalScore = null,
  canStartNextDeal = false,
  nextDealLoading = false,
  canPlay = false,
  phase,
  canChooseTrump = false,
  canDeclare = false,
  declarationTurnPlayerNumber,
  completedDeclarationPlayers = [],
  trumpTurnPlayerNumber,
  viewerPlayerNumber,
  belaDecisionOpen = false,
  pendingBelaCard = null,
  onConfirmBela,
  onPlayCard,
  onChooseTrump,
  onPassTrump,
  onSubmitDeclarations,
  onStartNextDeal,
}: GameTableProps) {
  const [declarationSelection, setDeclarationSelection] = useState<{
    turnKey: string;
    cards: BelotCard[];
  }>({ turnKey: "", cards: [] });
  const declarationTurnKey = `${phase}:${declarationTurnPlayerNumber ?? 0}`;
  const selectedDeclarationCards =
    declarationSelection.turnKey === declarationTurnKey
      ? declarationSelection.cards
      : [];

  function toggleDeclarationCard(card: BelotCard) {
    setDeclarationSelection((selection) => {
      const currentCards = selection.turnKey === declarationTurnKey
        ? selection.cards
        : [];
      const isSelected = currentCards.some(
        (selected) => selected.suit === card.suit && selected.rank === card.rank,
      );

      return {
        turnKey: declarationTurnKey,
        cards: isSelected
          ? currentCards.filter(
              (selected) => selected.suit !== card.suit || selected.rank !== card.rank,
            )
          : [...currentCards, card],
      };
    });
  }

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
  const sortedHand = [...hand].sort((first, second) => {
    const suitDifference = SUIT_ORDER.indexOf(first.suit) - SUIT_ORDER.indexOf(second.suit);
    return suitDifference || RANK_ORDER.indexOf(first.rank) - RANK_ORDER.indexOf(second.rank);
  });

  return (
    <main className="belot-game">
      <div className="belot-layout">
        <aside className="belot-sidebar">
          <div className="belot-sidebar-card">
            <div className="belot-sidebar-title">BELO T</div>

            <div className="result-table">
              <div className="result-header">
                <span>REZULTAT</span>
                <span>MI</span>
                <span>VI</span>
              </div>

              <div className="result-row">
                <span>Ovo dijeljenje</span>
                <strong>{finalScore?.team1 ?? team1Score}</strong>
                <strong>{finalScore?.team2 ?? team2Score}</strong>
              </div>
              <div className="result-row">
                <span>Zvanje</span>
                <strong>{finalScore?.winningTeam === 1 ? finalScore.declarationPoints : 0}</strong>
                <strong>{finalScore?.winningTeam === 2 ? finalScore.declarationPoints : 0}</strong>
                              <strong>{team1DeclarationPoints}</strong>
                              <strong>{team2DeclarationPoints}</strong>
              </div>
              <div className="result-row total-row">
                <span>MEČ</span>
                <strong>{team1MatchScore}</strong>
                <strong>{team2MatchScore}</strong>
              </div>
            </div>

          </div>

          <section className="game-chat-panel">
            <div className="game-chat-header">
              <h4>CHAT SOBE</h4>
            </div>

            <div className="game-chat-messages">
              {messages.length === 0 ? (
                <p className="game-chat-empty">Još nema poruka u ovoj partiji.</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.userId === currentUserId
                        ? "game-chat-message self"
                        : "game-chat-message"
                    }
                  >
                    <strong>{message.username}</strong>
                    <span>{message.message}</span>
                  </div>
                ))
              )}
            </div>

            <div className="game-chat-input-row">
              <input
                type="text"
                value={chatInput}
                onChange={(event) => onChatInputChange?.(event.target.value)}
                placeholder="Napiši poruku..."
                maxLength={300}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSendChat?.();
                  }
                }}
              />
              <button
                type="button"
                className="primary-button"
                onClick={onSendChat}
                aria-label="Pošalji poruku"
                title="Pošalji poruku"
              >
                ↑
              </button>
            </div>
          </section>
        </aside>

        <section className="belot-main-panel">
          <header className="belot-header">
            <div>
              <div className="belot-brand">BELOT</div>
              <div className="belot-subtitle">Klasična kartaška igra</div>
            </div>

            <div className="belot-score">
              <div>
                <span>Naša ekipa</span>
                <strong>{team1MatchScore}</strong>
              </div>
              <div className="score-divider" />
              <div>
                <span>Protivnici</span>
                <strong>{team2MatchScore}</strong>
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

        {phase !== "trump_call" && (
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
        )}

        <div className="played-cards">
          {playedCards.map((played, index) => {
            const player = playerByNumber(played.playerNumber);
            const playerPosition = player
              ? positions[(player.seat - viewerSeat + 4) % 4]
              : positions[index];

            return (
              <div
                className={`played-card played-card-${playerPosition}`}
                key={`${played.playerNumber}-${index}`}
              >
                <PlayingCard card={played.card} small />
                <span>{player?.username ?? `Igrač ${played.playerNumber}`}</span>
              </div>
            );
          })}

          {playedCards.length === 0 && phase === "playing" && (
            <div className="empty-table-message">Čeka se prva karta...</div>
          )}
        </div>

        {phase === "trump_call" && (
          <section className="trump-controls in-table-trump-controls">
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
                  className={`suit-button ${SUITS[suit].red ? "red-suit" : "black-suit"}`}
                  aria-label={SUITS[suit].name}
                >
                  <img src={SUITS[suit].icon} alt={SUITS[suit].name} />
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

        {phase === "declarations" && !activeDeclaration && (
          <section className="trump-controls in-table-trump-controls declaration-controls">
            <span className="declaration-progress">
              ZVANJA · {completedDeclarationPlayers.length}/4
            </span>
            <strong>
              {activeDeclaration
                ? "Zvanje se prikazuje svim igračima"
                : canDeclare
                ? "Odaberi karte i pozovi zvanje"
                : `Čeka se ${players.find((player) => player.seat + 1 === declarationTurnPlayerNumber)?.username ?? `igrač ${declarationTurnPlayerNumber ?? ""}`}`}
            </strong>
            {canDeclare && (
              <div className="declaration-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={selectedDeclarationCards.length === 0}
                  onClick={() => onSubmitDeclarations?.(selectedDeclarationCards)}
                >
                  Pozovi
                </button>
                <button
                  type="button"
                  className="pass-trump-button"
                  onClick={() => onSubmitDeclarations?.([])}
                >
                  Nemam zvanja
                </button>
              </div>
            )}

            {activeDeclaration && (
              <div className="declaration-reveal" aria-live="polite">
                <span className="declaration-reveal-player">
                  {players.find((player) => player.seat + 1 === activeDeclaration.playerNumber)?.username ?? "Igrač"} zove
                </span>
                <div className="declaration-reveal-cards">
                  {activeDeclaration.cards.map((card) => (
                    <PlayingCard
                      key={`${card.suit}-${card.rank}`}
                      card={card}
                      small
                      disabled
                    />
                  ))}
                </div>
                <strong>{activeDeclaration.points} bodova</strong>
              </div>
            )}
          </section>
        )}
          </section>
        </section>
      </div>

      {(phase === "round_finished" || phase === "finished") && (
        <div className="game-finished-message">
          <strong>
            {phase === "finished"
              ? `Meč je završio. Pobjeđuje ekipa ${matchWinnerTeam ?? ""}!`
              : `Dijeljenje ${roundNumber} je završeno.`}
          </strong>
          <span>
            Ova runda: {finalScore?.team1 ?? 0} : {finalScore?.team2 ?? 0}
          </span>
          <span>
            Meč do 1001: {team1MatchScore} : {team2MatchScore}
          </span>
          {phase === "round_finished" && (
            canStartNextDeal ? (
              <button
                className="primary-button next-deal-button"
                type="button"
                onClick={onStartNextDeal}
                disabled={nextDealLoading}
              >
                {nextDealLoading ? "Pokrećem..." : "Sljedeće dijeljenje"}
              </button>
            ) : (
              <span>Čeka se domaćin da pokrene sljedeće dijeljenje.</span>
            )
          )}
        </div>
      )}

      <footer className="belot-hand-area">
        <div className="hand-heading">
          <div>
            <strong>Tvoje karte</strong>
            <span>{hand.length} karata u ruci</span>
          </div>
          <span className="hand-hint">
            {canDeclare
              ? "Klikni karte koje želiš pozvati"
              : canPlay
                ? "Odaberi kartu za igranje"
                : "Čeka se tvoj potez"}
          </span>
        </div>

        <div className="belot-hand">
          {sortedHand.map((card, index) => (
            <PlayingCard
              key={`${card.suit}-${card.rank}-${index}`}
              card={card}
              selected={
                canDeclare && selectedDeclarationCards.some(
                  (selected) => selected.suit === card.suit && selected.rank === card.rank,
                )
              }
              disabled={!canPlay && !canDeclare}
              onClick={() => {
                if (canDeclare) {
                  toggleDeclarationCard(card);
                } else {
                  onPlayCard(card);
                }
              }}
            />
          ))}
        </div>
      </footer>

      {belaDecisionOpen && pendingBelaCard && (
        <div className="bela-confirmation-overlay">
          <div className="bela-confirmation-card">
            <div className="bela-confirmation-title">BELA</div>
            <p>
              Odigrali ste {SUITS[pendingBelaCard.suit].name} {pendingBelaCard.rank}. Želite li zvati belu?
            </p>
            <div className="bela-confirmation-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => onConfirmBela?.(true)}
              >
                DA
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onConfirmBela?.(false)}
              >
                NE
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
