
"use client";

import type { Room } from "../../types/belot";

type WaitingRoomProps = {
  room: Room;
  userId: number;
  loading: boolean;
  socketConnected: boolean;
  onStart: () => void;
  onLeave: () => void;
};

export default function WaitingRoom({
  room,
  userId,
  loading,
  socketConnected,
  onStart,
  onLeave,
}: WaitingRoomProps) {
  const isHost = room.players.some(
    (player) => player.userId === userId && player.isHost,
  );

  return (
    <div className="lobby-section">
      <div className="lobby-heading">
        <h3>Čekaonica</h3>
        <span className="room-code">{room.code}</span>
      </div>

      <p>
        {room.isPublic ? "Javna soba" : "Privatna soba"}
        {" · "}Minimalni rejting: {room.minRating}
      </p>

      <div className="seat-list">
        {Array.from({ length: room.maxPlayers }, (_, index) => {
          const player = room.players[index];

          return (
            <div className="seat" key={index}>
              <div className="seat-number">{index + 1}</div>
              <div>
                {player ? (
                  <>
                    <strong>{player.username}</strong>
                    <span>
                      {player.isHost ? "Domaćin" : "Igrač"}
                      {" · "}Rejting: {player.rating}
                    </span>
                  </>
                ) : (
                  <>
                    <strong>Čeka se igrač...</strong>
                    <span>Slobodno mjesto</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isHost && (
        <button
          className="primary-button"
          onClick={onStart}
          disabled={
            loading ||
            !socketConnected ||
            room.players.length !== 4
          }
        >
          {loading
            ? "Pokretanje..."
            : room.players.length === 4
              ? "Pokreni partiju"
              : `Čekaju se igrači (${room.players.length}/4)`}
        </button>
      )}

      <button
        className="secondary-button"
        onClick={onLeave}
        disabled={loading}
      >
        Napusti sobu
      </button>
    </div>
  );
}
