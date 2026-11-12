
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
  return (
    <div className="lobby-room-card" key={room.code}>
      <div>
        <strong>Soba {room.code}</strong>
        <p>
          {room.players.length}/{room.maxPlayers} igrača ·
          Minimalni rejting: {room.minRating}
        </p>
        <p>
          {room.players.map((player) => player.username).join(", ")}
        </p>
      </div>

      <button
        className="primary-button"
        onClick={() => onJoin(room.code)}
        disabled={loading || disabled}
      >
        Pridruži se
      </button>
    </div>
  );
}
