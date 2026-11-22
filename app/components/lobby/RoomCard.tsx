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
  const playerCount = room.players.length;
  const isFull = playerCount >= room.maxPlayers;

  return (
    <button
      type="button"
      className="belot-room-card"
      onClick={() => onJoin(room.code)}
      disabled={loading || disabled || isFull}
      aria-label={`Uđi u sobu ${host?.username ?? room.code}, ${playerCount} od ${room.maxPlayers} igrača`}
    >
      <div className="belot-room-info">
        <div className="belot-room-heading">
          <span className="belot-room-symbol" aria-hidden="true">♣</span>
          <div className="belot-room-heading-text">
            <strong className="belot-room-name">{host?.username ?? "Domaćin"}</strong>
            <span className="belot-room-description">
              {room.isPublic ? "Javna soba" : "🔒 Privatna soba"}
              {" · "}
              Min. rejting {room.minRating}
            </span>
          </div>
        </div>
        <div className="belot-room-settings" aria-label="Postavke partije">
          <div className="belot-room-setting">⏱ {room.turnDuration ?? 30} sek/potez</div>
          <div className="belot-room-setting">♣ {room.gameType === "dosta" ? "Dosta" : "Prolaz"}</div>
          <div className="belot-room-setting">🏆 Do {room.targetScore ?? 1001}</div>
        </div>
      </div>

      <div className="belot-room-right">
        <div className="belot-room-seats">
          {Array.from({ length: room.maxPlayers }, (_, index) => (
            <span
              key={index}
              className={`belot-room-seat ${
                index < playerCount ? "occupied" : "empty"
              }`}
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                width="21"
                height="21"
                fill="currentColor"
              >
                <circle cx="12" cy="7" r="4" />
                <path d="M4 21v-2c0-4 3.5-7 8-7s8 3 8 7v2H4z" />
              </svg>
            </span>
          ))}
        </div>

        <span className="belot-room-player-count">
          {playerCount}/{room.maxPlayers}
        </span>

        <span className="belot-room-enter" aria-hidden="true">
          ›
        </span>
      </div>
    </button>
  );
}
