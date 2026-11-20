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
  onCreateRoom: () => void;
  onJoinRoom: (code?: string) => void;
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
}: LobbyProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

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
          Unesi kod
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
                    : "Unesi kod privatne sobe."}
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
                    onCreateRoom();
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
                    roomCode.trim().length === 6 &&
                    !loading &&
                    socketConnected
                  ) {
                    onJoinRoom();
                  }
                }}
              >
                <div className="lobby-field">
                  <label htmlFor="lobby-room-code">Kod sobe</label>

                  <input
                    id="lobby-room-code"
                    className="lobby-code-input"
                    value={roomCode}
                    onChange={(event) =>
                      onRoomCodeChange(event.target.value.toUpperCase())
                    }
                    placeholder="ABC234"
                    maxLength={6}
                    autoComplete="off"
                    autoFocus
                  />

                  <small>
                    Unesi kod od 6 znakova koji ti je poslao domaćin.
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
                      roomCode.trim().length !== 6
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
                <RoomCard
                  key={room.code}
                  room={room}
                  loading={loading}
                  disabled={currentRoomExists}
                  onJoin={onJoinRoom}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
