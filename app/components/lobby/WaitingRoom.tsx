"use client";

import type { Room } from "../../types/belot";
import "./WaitingRoom.css";
import SharedIpWarning from "../common/SharedIpWarning";
import { useEffect, useMemo, useState } from "react";

export type AvailablePlayer = { userId: number; username: string; rating?: number };

type WaitingRoomProps = {
  room: Room;
  userId: number;
  availablePlayers: AvailablePlayer[];
  pendingInviteIds: number[];
  onInvitePlayer: (userId: number) => void;
  onOpenProfile?: (userId: number) => void;
  loading: boolean;
  socketConnected: boolean;
  error?: string;
  notice?: string;
  messages: Array<{
    id: number;
    roomCode: string;
    userId: number | null;
    username: string;
    message: string;
    createdAt: string | Date;
  }>;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
  onStart: () => void;
  onLeave: () => void;
  onKickPlayer: (playerSocketId: string) => void;
  onSwapPlayers: (firstSeat: number, secondSeat: number) => void;
};

export default function WaitingRoom({
  room,
  userId,
  availablePlayers,
  pendingInviteIds,
  onInvitePlayer,
  onOpenProfile,
  loading,
  socketConnected,
  error,
  notice,
  messages,
  chatInput,
  onChatInputChange,
  onSendChat,
  onStart,
  onLeave,
  onKickPlayer,
  onSwapPlayers,
}: WaitingRoomProps) {
  const [avatarIds, setAvatarIds] = useState<Record<string, number>>({});

  // Dohvati odabrane avatare za igrace u cekaonici.
  useEffect(() => {
    let active = true;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    Promise.all(room.players.map(async (player) => {
      try {
        const response = await fetch(`${apiUrl}/profiles/by-name/${encodeURIComponent(player.username)}`);
        if (!response.ok) return null;
        const data = await response.json();
        return { username: player.username, avatarId: data.profile?.avatarId as number };
      } catch { return null; }
    })).then((results) => {
      if (!active) return;
      const next: Record<string, number> = {};
      for (const result of results) {
        if (result && Number.isInteger(result.avatarId) && result.avatarId >= 1 && result.avatarId <= 12) next[result.username] = result.avatarId;
      }
      setAvatarIds(next);
    });
    return () => { active = false; };
  }, [room.players]);

  const isHost = room.players.some(
    (player) => player.userId === userId && player.isHost,
  );

  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const visiblePlayers = useMemo(() => availablePlayers.filter((player) =>
    player.userId !== userId &&
    !room.players.some((member) => member.userId === player.userId) &&
    player.username.toLocaleLowerCase("hr").includes(playerSearch.toLocaleLowerCase("hr"))
  ), [availablePlayers, playerSearch, room.players, userId]);

  function handleSeatClick(seat: number) {
    if (!isHost || loading) return;

    const player = room.players.find((player) => player.seat === seat + 1);

    if (!player) return;

    if (selectedSeat === null) {
      setSelectedSeat(seat);
      return;
    }

    if (selectedSeat === seat) {
      setSelectedSeat(null);
      return;
    }

    const firstPlayer = room.players.find(
      (player) => player.seat === selectedSeat + 1,
    );

    if (!firstPlayer) {
      setSelectedSeat(null);
      return;
    }

    onSwapPlayers(selectedSeat, seat);
    setSelectedSeat(null);
  }
  return (
    <main className="waiting-room-screen">
      <header className="waiting-room-topbar">
        <div className="waiting-room-brand">
          <span className="brand-mark">♠</span>
          <span>BELOT</span>
        </div>

        <div className="waiting-room-topbar-meta">
          <span className={socketConnected ? "online-dot" : "offline-dot"} />
          <span>{socketConnected ? "Povezan" : "Povezivanje..."}</span>
          <button
            className="waiting-room-leave"
            type="button"
            onClick={onLeave}
            disabled={loading}
          >
            Napusti sobu
          </button>
        </div>
      </header>

      <div className="waiting-room-layout">
        <section className="waiting-room-main">
          {error && (
            <div className="message error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="message success" role="status">
              {notice}
            </div>
          )}

          <div className="waiting-room-title-row">
            <div>
              <span className="waiting-room-eyebrow">
                {room.isPublic ? "JAVNA SOBA" : "PRIVATNA SOBA"}
              </span>
              <h1>Čekaonica</h1>
              <p>
                Kod za poziv: <strong>{room.code}</strong>
              </p>
            </div>
            <div className="waiting-room-player-count">
              <strong>{room.players.length}</strong>
              <span>/ {room.maxPlayers} igrača</span>
            </div>
          </div>

          <section className="waiting-room-players-panel">
            <div className="waiting-room-section-heading">
              <div>
                <span className="waiting-room-eyebrow">ZA STOLOM</span>
                <h2>Igrači</h2>
                {isHost && (
                  <p className="waiting-room-host-hint">
                    Klikni na dva igrača kako bi im zamijenio mjesta.
                  </p>
                )}
              </div>
              <span className="waiting-room-rating">
                Minimalni rejting {room.minRating}
              </span>
            </div>
            <div className="waiting-room-teams">
              {[
                { name: "MI", seats: [0, 2] },
                { name: "VI", seats: [1, 3] },
              ].map((team) => (
                <div className="waiting-team" key={team.name}>
                  <div className="waiting-team-heading">
                    <span className="waiting-team-label">{team.name}</span>
                    <span className="waiting-team-count">
                      {
                        team.seats.filter((seat) =>
                          room.players.some(
                            (player) => player.seat === seat + 1,
                          ),
                        ).length
                      }
                      /2 igrača
                    </span>
                  </div>

                  <div className="waiting-team-players">
                    {team.seats.map((seat) => {
                      const player = room.players.find(
                        (player) => player.seat === seat + 1,
                      );

                      return (
                        <div
                          key={seat}
                          className={`waiting-player-card ${
                            player ? "occupied" : "open"
                          } ${selectedSeat === seat ? "selected" : ""} ${
                            isHost && player ? "selectable" : ""
                          }`}
                          onClick={() => handleSeatClick(seat)}
                        >
                          <span className="waiting-player-seat">
                            0{seat + 1}
                          </span>

                          {player ? (
                            <>
                              <div className="waiting-avatar-with-warning">
                              <div className="waiting-player-avatar">
                                <img
                                  src={`/avatars/avatar-${String(avatarIds[player.username] ?? 1).padStart(2, "0")}.png`}
                                  alt={`Avatar ${player.username}`}
                                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                                />
                              </div>

                              <SharedIpWarning visible={player.sameIpWarning} />
                              </div>

                              <div className="waiting-player-info">
                                <button type="button" className="profile-name-button" onClick={(event) => { event.stopPropagation(); onOpenProfile?.(player.userId); }}><strong>{player.username}</strong></button>
                                <span>
                                  {player.isHost ? "Domaćin" : "Igrač"}
                                  {" · "}Rejting {player.rating}
                                </span>
                              </div>

                              {isHost && !player.isHost && (
                                <button
                                  className="waiting-player-remove"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onKickPlayer(player.id);
                                  }}
                                  disabled={loading}
                                  title={`Ukloni igrača ${player.username}`}
                                  aria-label={`Ukloni igrača ${player.username}`}
                                >
                                  ×
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="waiting-player-info">
                              <strong>Slobodno mjesto</strong>
                              <span>Čeka se igrač</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="waiting-room-start-row">
              {isHost ? (
                <button
                  className="primary-button waiting-room-start"
                  onClick={onStart}
                  disabled={
                    loading ||
                    !socketConnected ||
                    room.players.length !== room.maxPlayers
                  }
                >
                  {loading
                    ? "Pokretanje..."
                    : room.players.length === room.maxPlayers
                      ? "Pokreni partiju"
                      : `Čekaju se igrači (${room.players.length}/${room.maxPlayers})`}
                </button>
              ) : (
                <p className="waiting-room-wait-message">
                  Čeka se da domaćin pokrene partiju.
                </p>
              )}
            </div>
          </section>
        </section>
        <aside className="waiting-invite-panel" aria-label="Aktivni igrači">
          <div className="waiting-invite-heading">
            <span className="waiting-room-eyebrow">ONLINE</span>
            <h2>Aktivni igrači <span>({visiblePlayers.length})</span></h2>
            <p>{isHost ? "Pozovi slobodne igrače u svoju sobu." : "Slobodni igrači koji su trenutno online."}</p>
          </div>
          <input
            className="waiting-invite-search"
            type="search"
            placeholder="Pretraži igrače..."
            aria-label="Pretraži aktivne igrače"
            value={playerSearch}
            onChange={(event) => setPlayerSearch(event.target.value)}
          />
          <div className="waiting-invite-list">
            {visiblePlayers.length === 0 ? (
              <p className="waiting-invite-empty">Nema slobodnih igrača za prikaz.</p>
            ) : visiblePlayers.map((player) => (
              <div className="waiting-invite-player" key={player.userId}>
                <span className="waiting-invite-avatar">{player.username.slice(0, 1).toUpperCase()}</span>
                <div className="waiting-invite-player-info">
                  <strong>{player.username}</strong>
                  <span>Rejting: {player.rating ?? "—"}</span>
                </div>
                {isHost && (
                  <button type="button" className="waiting-invite-button"
                    disabled={loading || !socketConnected || room.players.length >= room.maxPlayers || pendingInviteIds.includes(player.userId)}
                    onClick={() => onInvitePlayer(player.userId)}>
                    {pendingInviteIds.includes(player.userId) ? "Pozvan ✓" : "Pozovi"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
