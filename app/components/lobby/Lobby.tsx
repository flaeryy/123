"use client";

import { useState } from "react";
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
  // Koji je prozor za postavke trenutno otvoren.
  const [activePanel, setActivePanel] = useState<"create" | "join" | null>(
    null,
  );
  return (
    <div className="lobby-workspace lobby-new-layout">
      {/* GLAVNI GUMBI */}
      <div className="lobby-main-actions">
        <button
          type="button"
          className="lobby-create-button"
          onClick={() =>
            setActivePanel((previous) =>
              previous === "create" ? null : "create",
            )
          }
        >
          <span aria-hidden="true">＋</span>
          Kreiraj sobu
        </button>

        <button
          type="button"
          className="lobby-code-button"
          onClick={() =>
            setActivePanel((previous) => (previous === "join" ? null : "join"))
          }
        >
          <span aria-hidden="true">⌕</span>
          Unesi kod
        </button>
      </div>

      {/* POSTAVKE KREIRANJA SOBE */}
      {activePanel === "create" && (
        <section className="lobby-action-panel">
          <h3>Kreiraj novu sobu</h3>

          <label>
            Vrsta sobe
            <select
              value={isPublic ? "public" : "private"}
              onChange={(event) =>
                onPublicChange(event.target.value === "public")
              }
            >
              <option value="public">Javna soba</option>
              <option value="private">Privatna soba</option>
            </select>
          </label>

          <label>
            Minimalni rejting
            <select
              value={minRating}
              onChange={(event) => onMinRatingChange(event.target.value)}
            >
              {Array.from({ length: 11 }, (_, index) => (
                <option key={index} value={index}>
                  {index}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="lobby-create-button"
            onClick={onCreateRoom}
            disabled={loading || !socketConnected}
          >
            {loading ? "Stvaram sobu..." : "Potvrdi kreiranje"}
          </button>
        </section>
      )}

      {/* ULAZAK POMOĆU KODA */}
      {activePanel === "join" && (
        <section className="lobby-action-panel">
          <h3>Ulazak u privatnu sobu</h3>

          <label>
            Kod sobe
            <input
              value={roomCode}
              onChange={(event) =>
                onRoomCodeChange(event.target.value.toUpperCase())
              }
              placeholder="Npr. ABC234"
              maxLength={6}
            />
          </label>

          <button
            type="button"
            className="lobby-create-button"
            onClick={() => onJoinRoom()}
            disabled={loading || !socketConnected}
          >
            Uđi u sobu
          </button>
        </section>
      )}

      {/* SLOBODNE SOBE */}
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
