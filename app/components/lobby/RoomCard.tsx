"use client";

import type { Room } from "../../types/belot";

type RoomCardProps = {
  room: Room;
  loading: boolean;
  disabled: boolean;
  onJoin: (code: string) => void;
  onPrivateJoin: () => void;
};

export default function RoomCard({
  room,
  loading,
  disabled,
  onJoin,
  onPrivateJoin,
}: RoomCardProps) {
  const host = room.players.find((player) => player.isHost);
  const playerCount = room.players.length;
  const isFull = playerCount >= room.maxPlayers;

  return (
    <button
      type="button"
      className={`belot-room-card ${room.isPublic ? "" : "belot-room-card-private"}`}
      onClick={() => {
        if (room.isPublic) onJoin(room.code);
        else onPrivateJoin();
      }}
      disabled={loading || disabled || isFull}
      aria-label={room.isPublic
        ? `Uđi u sobu ${host?.username ?? room.code}, ${playerCount} od ${room.maxPlayers} igrača`
        : `Privatna soba korisnika ${host?.username ?? "Domaćin"}; za ulazak je potreban kod sobe`}
    >
      <div className="belot-room-info">
        <div className="belot-room-heading">
          <span className="belot-room-symbol" aria-hidden="true">
            {room.isPublic ? "♣" : <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>}
          </span>
          <div className="belot-room-heading-text">
            <strong className="belot-room-name">{host?.username ?? "Domaćin"}</strong>
            <span className="belot-room-description">
              {room.isPublic ? "Javna soba" : "Privatna soba · potreban kod"}
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
          {room.isPublic ? "›" : <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>}
        </span>
      </div>
    </button>
  );
}
