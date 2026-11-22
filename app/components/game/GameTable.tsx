"use client";

import { useEffect, useState } from "react";
import HungarianCard from "./HungarianCard";
import "./GameTable.css";
import { GameDialogs } from "./GameDialogs/GameDialogs";
import ChatPanel from "../chat/ChatPanel";
import type { ChatMessage } from "../chat/chat.types";

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
  isDealer?: boolean;
};

export type PlayedCard = {
  playerNumber: number;
  card: BelotCard;
};

type GameTableProps = {
  players: TablePlayer[];
  hand: BelotCard[];
  playedCards: PlayedCard[];
  trickCollectWinner?: number | null;
  currentPlayerId: string | null;
  viewerId: string;
  currentUserId?: number;
  onOpenProfile?: (username: string) => void;
  messages?: ChatMessage[];
  chatInput?: string;
  onChatInputChange?: (value: string) => void;
  onSendChat?: () => void;
  trump: BelotSuit | null;
  team1Score: number;
  team2Score: number;
  team1MatchScore?: number;
  team2MatchScore?: number;
  roundHistory?: {
    roundNumber: number;
    team1: number;
    team2: number;
  }[];
  roundNumber?: number;
  matchWinnerTeam?: 1 | 2 | null;
  team1DeclarationPoints?: number;
  team2DeclarationPoints?: number;
  activeDeclarations?: {
    playerNumber: 1 | 2 | 3 | 4;
    cards: BelotCard[];
    points: number;
  }[];
  finalScore?: {
    team1: number;
    team2: number;
    winningTeam: 1 | 2 | null;
    declarationPoints: number;
  } | null;
  canStartNextDeal?: boolean;
  nextDealLoading?: boolean;
  canPlay?: boolean;
  phase:
    | "dealing"
    | "trump_call"
    | "dealing_remaining"
    | "declarations"
    | "playing"
    | "round_finished"
    | "finished";
  canChooseTrump?: boolean;
  canPassTrump?: boolean;
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
  team1Bela?: number;
  team2Bela?: number;
};

const SUITS: Record<
  BelotSuit,
  { symbol: string; name: string; red: boolean; icon: string }
> = {
  hearts: {
    symbol: "♥",
    name: "Herc",
    red: true,
    icon: "/cards/icons/heart-icon.png",
  },
  diamonds: {
    symbol: "♦",
    name: "Karo",
    red: true,
    icon: "/cards/icons/bell-icon.png",
  },
  clubs: {
    symbol: "♣",
    name: "Tref",
    red: false,
    icon: "/cards/icons/acorn-icon.png",
  },
  spades: {
    symbol: "♠",
    name: "Pik",
    red: false,
    icon: "/cards/icons/leaf-icon.png",
  },
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
  trickCollectWinner = null,
  currentPlayerId,
  viewerId,
  currentUserId,
  onOpenProfile,
  messages = [],
  chatInput = "",
  onChatInputChange,
  onSendChat,
  trump,
  team1Score,
  team2Score,
  team1MatchScore = team1Score,
  team2MatchScore = team2Score,
  roundHistory = [],
  roundNumber = 1,
  matchWinnerTeam = null,
  team1DeclarationPoints = 0,
  team2DeclarationPoints = 0,
  activeDeclarations = [],
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
  team1Bela = 0,
  team2Bela = 0,
  onConfirmBela,
  onPlayCard,
  onChooseTrump,
  onPassTrump,
  onSubmitDeclarations,
  onStartNextDeal,
}: GameTableProps) {
  const [showRoundHistory, setShowRoundHistory] = useState(false);
  const [playerAvatars, setPlayerAvatars] = useState<Record<string, number>>({});
  const playerNamesKey = players.map((player) => player.username).join("|");

  useEffect(() => {
    let active = true;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const names = playerNamesKey.split("|").filter(Boolean);
    Promise.all(names.map(async (username) => {
      try {
        const response = await fetch(`${apiUrl}/profiles/by-name/${encodeURIComponent(username)}`);
        if (!response.ok) return null;
        const data = await response.json();
        return { username, avatarId: data.profile?.avatarId as number };
      } catch {
        return null;
      }
    })).then((results) => {
      if (!active) return;
      const next: Record<string, number> = {};
      for (const result of results) {
        if (result && Number.isInteger(result.avatarId) && result.avatarId >= 1 && result.avatarId <= 12) {
          next[result.username] = result.avatarId;
        }
      }
      setPlayerAvatars(next);
    });
    return () => { active = false; };
  }, [playerNamesKey]);

  const [declarationSelection, setDeclarationSelection] = useState<{
    turnKey: string;
    cards: BelotCard[];
  }>({ turnKey: "", cards: [] });
  const declarationTurnKey = `${roundNumber}:${phase}:${declarationTurnPlayerNumber ?? 0}`;
  const selectedDeclarationCards =
    declarationSelection.turnKey === declarationTurnKey
      ? declarationSelection.cards
      : [];

  const declarationTurnPlayerName =
    players.find((player) => player.seat + 1 === declarationTurnPlayerNumber)
      ?.username ?? `igrač ${declarationTurnPlayerNumber ?? ""}`;

  function toggleDeclarationCard(card: BelotCard) {
    setDeclarationSelection((selection) => {
      const currentCards =
        selection.turnKey === declarationTurnKey ? selection.cards : [];
      const isSelected = currentCards.some(
        (selected) =>
          selected.suit === card.suit && selected.rank === card.rank,
      );

      return {
        turnKey: declarationTurnKey,
        cards: isSelected
          ? currentCards.filter(
              (selected) =>
                selected.suit !== card.suit || selected.rank !== card.rank,
            )
          : [...currentCards, card],
      };
    });
  }

  // Redoslijed poteza je suprotan smjeru kazaljke na satu: nakon mene igra desni igrac.
  const positions = ["bottom", "right", "top", "left"] as const;
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
    const suitDifference =
      SUIT_ORDER.indexOf(first.suit) - SUIT_ORDER.indexOf(second.suit);
    return (
      suitDifference ||
      RANK_ORDER.indexOf(first.rank) - RANK_ORDER.indexOf(second.rank)
    );
  });

  // Prikaz dvije skrivene karte dok adut još nije odabran.
  const showHiddenCards = trump === null && hand.length === 6;

  const canPassTrump =
    canChooseTrump && !playerByNumber(trumpTurnPlayerNumber ?? 0)?.isDealer;

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
                <span>Zvanja</span>
                <strong>{team1DeclarationPoints + team1Bela}</strong>
                <strong>{team2DeclarationPoints + team2Bela}</strong>
              </div>
              <div className="result-row total-row">
                <span>Ukupno</span>
                <strong>{team1MatchScore}</strong>
                <strong>{team2MatchScore}</strong>
              </div>

              <button
                type="button"
                className="round-history-toggle"
                onClick={() => setShowRoundHistory((previous) => !previous)}
              >
                <span>Pregled cijele partije</span>
                <span>{showRoundHistory ? "▲" : "▼"}</span>
              </button>

              {showRoundHistory && (
                <div className="round-history">
                  <div className="round-history-header">
                    <span>Runda</span>
                    <span>MI</span>
                    <span>VI</span>
                  </div>

                  {roundHistory.map((round) => (
                    <div className="round-history-row" key={round.roundNumber}>
                      <span>{round.roundNumber}.</span>
                      <strong>{round.team1}</strong>
                      <strong>{round.team2}</strong>
                    </div>
                  ))}

                  {roundHistory.length === 0 && (
                    <div className="round-history-empty">
                      Još nema završenih rundi.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <ChatPanel
            messages={messages}
            currentUserId={currentUserId}
            input={chatInput}
            onInputChange={onChatInputChange}
            onSend={onSendChat}
          />
        </aside>
        <section className="belot-main-panel">
          {trump && (
            <div className="belot-trump-corner">
              <span>ADUT</span>
              <img
                src={SUITS[trump].icon}
                alt={SUITS[trump].name}
                className="trump-icon"
              />
              <strong>{SUITS[trump].name}</strong>
            </div>
          )}

          <div className="belot-table-wrapper">
            <section className="belot-table">
              <div className="table-decoration" />

              <div className={`played-cards${trickCollectWinner !== null && playedCards.length === 4 ? " trick-collecting" : ""} trick-winner-${trickCollectWinner !== null ? positions[((trickCollectWinner - 1 - viewerSeat) + 4) % 4] : "none"}`}>
              {playedCards.map((played, index) => {
                const player = playerByNumber(played.playerNumber);
                const playerPosition = player
                  ? positions[(player.seat - viewerSeat + 4) % 4]
                  : positions[index];

                return (
                  <div
                    className={`played-card played-card-${playerPosition} played-card-order-${index + 1}`}
                    key={`${played.playerNumber}-${index}`}
                  >
                    <PlayingCard card={played.card} small />
                    <span>
                      {player?.username ?? `Igrač ${played.playerNumber}`}
                    </span>
                  </div>
                );
              })}

              {playedCards.length === 0 && phase === "playing" && (
                <div className="empty-table-message">Čeka se prva karta...</div>
              )}
            </div>

            <GameDialogs
              phase={phase}
              canChooseTrump={canChooseTrump}
              canPassTrump={canPassTrump}
              trumpTurnPlayerNumber={trumpTurnPlayerNumber}
              suitOrder={SUIT_ORDER}
              suits={SUITS}
              onChooseTrump={onChooseTrump}
              onPassTrump={onPassTrump}
              completedDeclarationPlayers={completedDeclarationPlayers.length}
              canDeclare={canDeclare}
              declarationTurnPlayerName={declarationTurnPlayerName}
              selectedDeclarationCards={selectedDeclarationCards}
              onSubmitDeclarations={onSubmitDeclarations}
            />
            </section>
            <div className="table-players">
            {sortedPlayers.map((player, index) => {
              const position = positions[index];
              const isCurrent = player.id === currentPlayerId;

              return (
                <div
                  key={player.id}
                  className={`table-player player-${position} ${
                    isCurrent ? "active-player" : ""
                  }`}
                >
                  <div className="player-avatar">
                    <img
                      src={`/avatars/avatar-${String(playerAvatars[player.username] ?? 1).padStart(2, "0")}.png`}
                      alt={player.username}
                      className="man"
                      onError={(event) => {
                        const image = event.currentTarget;
                        if (!image.src.endsWith("/avatars/avatar-01.png")) image.src = "/avatars/avatar-01.png";
                      }}
                    />
                  </div>
                  {player.isDealer && (
                    <div className="dealer-deck" role="img" aria-label="Djelitelj karata" title="Djelitelj">
                      <span className="dealer-deck-card dealer-deck-card-back" />
                      <span className="dealer-deck-card dealer-deck-card-middle" />
                      <span className="dealer-deck-card dealer-deck-card-front" />
                    </div>
                  )}
                  {activeDeclarations
                    .filter((declaration) => declaration.playerNumber === player.seat + 1)
                    .map((declaration) => (
                      <div
                        className="player-declaration-cards"
                        key={`declaration-${declaration.playerNumber}`}
                        aria-label={`Zvanje: ${declaration.points} bodova`}
                      >
                        {declaration.cards.map((card, cardIndex) => (
                          <PlayingCard
                            key={`${card.suit}-${card.rank}-${cardIndex}`}
                            card={card}
                            small
                            disabled
                          />
                        ))}
                      </div>
                    ))}
                  <div className="player-info">
                    <button type="button" className="profile-name-button" onClick={() => onOpenProfile?.(player.username)}><strong>{player.username}</strong></button>
                  </div>
                  {isCurrent && <span className="turn-indicator">●</span>}
                </div>
              );
            })}

            </div>
            {belaDecisionOpen && pendingBelaCard && (
                    <div className="bela-confirmation-overlay">
                      <div className="bela-confirmation-card">
                        <p>Želite li zvati belu?</p>
                        <div className="bela-confirmation-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => onConfirmBela?.(true)}
                          >
                            Bela
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => onConfirmBela?.(false)}
                          >
                            Ne
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
          </div>
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
        </div>
      )}

      {(sortedHand.length > 0 || showHiddenCards) && (
      <footer className="belot-hand-area">
        <div className="belot-hand">
          {sortedHand.map((card, index) => (
            <PlayingCard
              key={`${card.suit}-${card.rank}-${index}`}
              card={card}
              selected={
                canDeclare &&
                selectedDeclarationCards.some(
                  (selected) =>
                    selected.suit === card.suit && selected.rank === card.rank,
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

          {showHiddenCards &&
            Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`hidden-card-${index}`}
                className="hand-hungarian-card hidden-hand-card"
              >
                <img src="/cards/back/back.png" alt="Skrivena karta" />
              </div>
            ))}
        </div>
      </footer>
      )}

    </main>
  );
}
