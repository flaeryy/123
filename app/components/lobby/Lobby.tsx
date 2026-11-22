"use client";

import { useEffect, useState } from "react";
import type { Room } from "../../types/belot";
import RoomCard from "./RoomCard";
import "./Lobby.css";

type LobbyProps = {
  publicRooms: Room[];
  loading: boolean;
  socketConnected: boolean;
  currentRoomExists: boolean;
  isPublic: boolean;
  minRating: string;
  roomCode: string;
  onPublicChange: (value: boolean) => void;
  onMinRatingChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onCreateRoom: (settings: { turnDuration: 15 | 30 | 45; gameType: "prolaz" | "dosta"; targetScore: 501 | 701 | 1001 }) => void;
  onJoinRoom: (code?: string) => void;
  onOpenProfile?: (userId: number) => void;
};

type ActivePanel = "create" | "join" | null;

export default function Lobby({
  publicRooms,
  loading,
  socketConnected,
  currentRoomExists,
  isPublic,
  minRating,
  roomCode,
  onPublicChange,
  onMinRatingChange,
  onRoomCodeChange,
  onCreateRoom,
  onJoinRoom,
  onOpenProfile,
}: LobbyProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  // Samo frontend: opcije jos nisu dio create_room zahtjeva ni servera.
  const [turnDuration, setTurnDuration] = useState<15 | 30 | 45>(30);
  const [gameType, setGameType] = useState<"prolaz" | "dosta">("prolaz");
  const [targetScore, setTargetScore] = useState<501 | 701 | 1001>(1001);

  const closePanel = () => setActivePanel(null);

  useEffect(() => {
    if (!activePanel) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePanel(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activePanel]);

  return (
    <div className="lobby-workspace lobby-new-layout">
      {/* GLAVNE AKCIJE */}
      <div className="lobby-main-actions">
        <button
          type="button"
          className="lobby-create-button"
          onClick={() => setActivePanel("create")}
          disabled={loading || currentRoomExists}
        >
          <span aria-hidden="true">＋</span>
          Kreiraj sobu
        </button>

        <button
          type="button"
          className="lobby-code-button"
          onClick={() => setActivePanel("join")}
          disabled={loading || currentRoomExists}
        >
          <span aria-hidden="true">⌕</span>
          Unesi šifru
        </button>
      </div>

      {/* POPUP */}
      {activePanel && (
        <div
          className="lobby-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePanel();
            }
          }}
        >
          <section
            className="lobby-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lobby-modal-title"
          >
            <div className="lobby-modal-header">
              <div>
                <h2 id="lobby-modal-title">
                  {activePanel === "create" ? "Kreiraj sobu" : "Ulazak u sobu"}
                </h2>

                <p>
                  {activePanel === "create"
                    ? "Odaberi postavke nove partije."
                    : "Unesi šifru privatne sobe."}
                </p>
              </div>

              <button
                type="button"
                className="lobby-modal-close"
                onClick={closePanel}
                aria-label="Zatvori"
              >
                ×
              </button>
            </div>

            {activePanel === "create" ? (
              <form
                className="lobby-modal-body"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!loading && socketConnected) {
                    onCreateRoom({ turnDuration, gameType, targetScore });
                  }
                }}
              >
                <div className="lobby-field">
                  <label htmlFor="lobby-room-type">Vrsta sobe</label>

                  <select
                    id="lobby-room-type"
                    value={isPublic ? "public" : "private"}
                    onChange={(event) =>
                      onPublicChange(event.target.value === "public")
                    }
                  >
                    <option value="public">Javna soba</option>
                    <option value="private">Privatna soba</option>
                  </select>

                  <small>
                    {isPublic
                      ? "Soba je vidljiva ostalim igračima."
                      : "Igrači ulaze pomoću koda sobe."}
                  </small>
                </div>

                <div className="lobby-field">
                  <label htmlFor="lobby-min-rating">Minimalni rejting</label>

                  <select
                    id="lobby-min-rating"
                    value={minRating}
                    onChange={(event) => onMinRatingChange(event.target.value)}
                  >
                    {Array.from({ length: 11 }, (_, index) => (
                      <option key={index} value={index}>
                        {index}
                      </option>
                    ))}
                  </select>

                  <small>Igrači moraju imati barem odabrani rejting.</small>
                </div>

                <div className="lobby-game-settings" aria-label="Postavke igre">
                  <h3>Postavke igre</h3>
                  <div className="lobby-game-settings-grid">
                    <div className="lobby-field">
                      <label htmlFor="lobby-turn-duration">Trajanje poteza (sek)</label>
                      <select
                        id="lobby-turn-duration"
                        value={turnDuration}
                        onChange={(event) => setTurnDuration(Number(event.target.value) as 15 | 30 | 45)}
                      >
                        <option value={15}>15 sekundi</option>
                        <option value={30}>30 sekundi</option>
                        <option value={45}>45 sekundi</option>
                      </select>
                    </div>

                    <div className="lobby-field">
                      <label htmlFor="lobby-game-type">Tip igre</label>
                      <select
                        id="lobby-game-type"
                        value={gameType}
                        onChange={(event) => setGameType(event.target.value as "prolaz" | "dosta")}
                      >
                        <option value="prolaz">Prolaz</option>
                        <option value="dosta">Dosta</option>
                      </select>
                    </div>

                    <div className="lobby-field">
                      <label htmlFor="lobby-target-score">Igra se do</label>
                      <select
                        id="lobby-target-score"
                        value={targetScore}
                        onChange={(event) => setTargetScore(Number(event.target.value) as 501 | 701 | 1001)}
                      >
                        <option value={1001}>1001 bod</option>
                        <option value={701}>701 bod</option>
                        <option value={501}>501 bod</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="lobby-modal-footer">
                  <button
                    type="button"
                    className="lobby-modal-cancel"
                    onClick={closePanel}
                  >
                    Odustani
                  </button>

                  <button
                    type="submit"
                    className="lobby-modal-confirm"
                    disabled={loading || !socketConnected}
                  >
                    {loading ? "Kreiranje..." : "Kreiraj sobu"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="lobby-modal-body"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    /^\d{4}$/.test(roomCode.trim()) &&
                    !loading &&
                    socketConnected
                  ) {
                    onJoinRoom();
                  }
                }}
              >
                <div className="lobby-field">
                  <label htmlFor="lobby-room-code">Šifra sobe</label>

                  <input
                    id="lobby-room-code"
                    className="lobby-code-input"
                    value={roomCode}
                    onChange={(event) =>
                      onRoomCodeChange(event.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="1234"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    autoComplete="off"
                    autoFocus
                  />

                  <small>
                    Unesi šifru od 6 znakova koji ti je poslao domaćin.
                  </small>
                </div>

                <div className="lobby-modal-footer">
                  <button
                    type="button"
                    className="lobby-modal-cancel"
                    onClick={closePanel}
                  >
                    Odustani
                  </button>

                  <button
                    type="submit"
                    className="lobby-modal-confirm"
                    disabled={
                      loading ||
                      !socketConnected ||
                      !/^\d{4}$/.test(roomCode.trim())
                    }
                  >
                    Uđi u sobu
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {/* POPIS SOBA */}
      <section className="lobby-available-section">
        <div className="lobby-available-heading">
          <h2>Lista slobodnih igara</h2>
          <span>{publicRooms.length}</span>
        </div>

        <div className="lobby-available-content">
          {publicRooms.length === 0 ? (
            <div className="empty-room-list">
              <strong>Nema slobodnih soba</strong>
              <p>Kreiraj novu sobu i pozovi prijatelje.</p>
            </div>
          ) : (
            <div className="public-room-list">
              {publicRooms.map((room) => (
                <div key={`${room.code}-${room.players[0]?.id ?? ""}`} className="lobby-room-with-profile">
                <RoomCard
                  room={room}
                  loading={loading}
                  disabled={currentRoomExists}
                  onJoin={onJoinRoom}
                  onPrivateJoin={() => setActivePanel("join")}
                />
                {room.players.find((player) => player.isHost) && (
                  <button type="button" className="lobby-host-profile-button" onClick={() => onOpenProfile?.(room.players.find((player) => player.isHost)!.userId)}>Profil domaćina</button>
                )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
