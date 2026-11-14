
"use client";

import type { Room } from "../../types/belot";

type RoomCardProps = {
  room: Room;
  loading: boolean;
  disabled: boolean;
  onJoin: (code: string) => void;
};

export default function RoomCard({
  room,
  loading,
  disabled,
  onJoin,
}: RoomCardProps) {
  const host = room.players.find((player) => player.isHost);

  return (
    <div className="public-room-row" role="row">
      <div className="room-list-code" role="cell">
        <span className="room-list-status" aria-hidden="true" />
        <div>
          <strong>{room.code}</strong>
          <span>{host?.username ?? "Domaćin"}</span>
        </div>
      </div>

      <div className="room-list-players" role="cell">
        {room.players.map((player) => (
          <span className="room-player-name" key={player.id}>
            {player.username}
            {player.isHost && <span className="room-host-mark">DOMAĆIN</span>}
          </span>
        ))}
      </div>

      <div className="room-list-seats" role="cell" aria-label={`${room.players.length} od ${room.maxPlayers} mjesta zauzeto`}>
        {Array.from({ length: room.maxPlayers }, (_, index) => (
          <span
            className={`room-seat-dot ${index < room.players.length ? "occupied" : ""}`}
            key={index}
            aria-hidden="true"
          />
        ))}
        <span className="room-seat-count">{room.players.length}/{room.maxPlayers}</span>
      </div>

      <div className="room-list-rating" role="cell">{room.minRating}</div>

      <div className="room-list-action" role="cell">
        <button
          className="primary-button"
          onClick={() => onJoin(room.code)}
          disabled={loading || disabled}
        >
          Uđi
        </button>
      </div>
    </div>
  );
}
