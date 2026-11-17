"use client";

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
  return (
    <div className="lobby-workspace">
      <div className="lobby-control-column">
        <section className="lobby-section lobby-panel create-room-panel">
          <div className="lobby-panel-heading">
            <span className="lobby-panel-index">01</span>
            <div>
              <span className="lobby-panel-kicker">NOVA IGRA</span>
              <h2>Stvori sobu</h2>
            </div>
          </div>

          <label>
            VRSTA SOBE
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
            MINIMALNI REJTING
            <select
              value={minRating}
              onChange={(event) => onMinRatingChange(event.target.value)}
            >
              {Array.from({ length: 11 }, (_, index) => (
                <option value={index} key={index}>
                  {index}
                </option>
              ))}
            </select>
          </label>

          <button
            className="primary-button"
            onClick={onCreateRoom}
            disabled={loading || !socketConnected}
          >
            {loading ? "Stvaram sobu..." : "Stvori sobu"}
          </button>
        </section>

        <section className="lobby-section lobby-panel join-code-panel">
          <div className="lobby-panel-heading">
            <span className="lobby-panel-index">02</span>
            <div>
              <span className="lobby-panel-kicker">POZIVNICA</span>
              <h2>Uđi u sobu</h2>
            </div>
          </div>

          <label>
            KOD SOBE
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
            className="secondary-button"
            onClick={() => onJoinRoom()}
            disabled={loading || !socketConnected}
          >
            Pridruži se kodom
          </button>
        </section>
      </div>

      <section className="lobby-section lobby-panel public-rooms-panel">
        <div className="lobby-heading">
          <div>
            <span className="lobby-panel-kicker">OTVORENE ZA IGRAČE</span>
            <h2>Javne sobe</h2>
          </div>
          <span className="public-room-count">{publicRooms.length}</span>
        </div>

        {publicRooms.length === 0 ? (
          <div className="empty-room-list">
            <span className="empty-room-mark" aria-hidden="true">
              ♧
            </span>
            <strong>Nema otvorenih soba</strong>
            <p>Stvori novu sobu ili se pridruži kodom pozivnice.</p>
          </div>
        ) : (
          <div className="public-room-table-scroll">
            <div
              className="public-room-list"
              role="table"
              aria-label="Javne sobe"
            >
              <div
                className="public-room-row public-room-table-head"
                role="row"
              >
                <span role="columnheader">SOBA</span>
                <span role="columnheader">IGRAČI</span>
                <span role="columnheader">MJESTA</span>
                <span role="columnheader">MIN. REJTING</span>
                <span role="columnheader" aria-label="Akcija" />
              </div>
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
          </div>
        )}
      </section>
    </div>
  );
}
