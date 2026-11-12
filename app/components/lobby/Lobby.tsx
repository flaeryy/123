
"use client";

import type { Room } from "../../types/belot";
import RoomCard from "./RoomCard";

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
    <>
      <div className="lobby-section">
        <h3>Stvori novu sobu</h3>

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
          Stvori sobu
        </button>
      </div>

      <div className="lobby-section">
        <h3>Uđi u privatnu sobu</h3>

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
      </div>

      <div className="lobby-section">
        <div className="lobby-heading">
          <h3>Javne sobe</h3>
          <span>{publicRooms.length}</span>
        </div>

        {publicRooms.length === 0 ? (
          <p>Trenutačno nema dostupnih javnih soba.</p>
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
    </>
  );
}
