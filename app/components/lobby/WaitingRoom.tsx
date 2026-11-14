
"use client";

import type { Room } from "../../types/belot";

type WaitingRoomProps = {
  room: Room;
  userId: number;
  loading: boolean;
  socketConnected: boolean;
  error?: string;
  notice?: string;
  messages: Array<{
    id: number;
    roomCode: string;
    userId: number | null;
    username: string;
    message: string;
    createdAt: string | Date;
  }>;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
  onStart: () => void;
  onLeave: () => void;
  onKickPlayer: (playerSocketId: string) => void;
};

export default function WaitingRoom({
  room,
  userId,
  loading,
  socketConnected,
  error,
  notice,
  messages,
  chatInput,
  onChatInputChange,
  onSendChat,
  onStart,
  onLeave,
  onKickPlayer,
}: WaitingRoomProps) {
  const isHost = room.players.some(
    (player) => player.userId === userId && player.isHost,
  );

  return (
    <main className="waiting-room-screen">
      <header className="waiting-room-topbar">
        <div className="waiting-room-brand">
          <span className="brand-mark">♠</span>
          <span>BELOT</span>
        </div>

        <div className="waiting-room-topbar-meta">
          <span className={socketConnected ? "online-dot" : "offline-dot"} />
          <span>{socketConnected ? "Povezan" : "Povezivanje..."}</span>
          <button
            className="waiting-room-leave"
            type="button"
            onClick={onLeave}
            disabled={loading}
          >
            Napusti sobu
          </button>
        </div>
      </header>

      <div className="waiting-room-layout">
        <section className="waiting-room-main">
          {error && <div className="message error" role="alert">{error}</div>}
          {notice && <div className="message success" role="status">{notice}</div>}

          <div className="waiting-room-title-row">
            <div>
              <span className="waiting-room-eyebrow">
                {room.isPublic ? "JAVNA SOBA" : "PRIVATNA SOBA"}
              </span>
              <h1>Čekaonica</h1>
              <p>Kod za poziv: <strong>{room.code}</strong></p>
            </div>
            <div className="waiting-room-player-count">
              <strong>{room.players.length}</strong>
              <span>/ {room.maxPlayers} igrača</span>
            </div>
          </div>

          <section className="waiting-room-players-panel">
            <div className="waiting-room-section-heading">
              <div>
                <span className="waiting-room-eyebrow">ZA STOLOM</span>
                <h2>Igrači</h2>
              </div>
              <span className="waiting-room-rating">
                Minimalni rejting {room.minRating}
              </span>
            </div>

            <div className="waiting-room-seats">
              {Array.from({ length: room.maxPlayers }, (_, index) => {
                const player = room.players[index];

                return (
                  <div
                    className={`waiting-player-card ${player ? "occupied" : "open"}`}
                    key={player?.id ?? `open-${index}`}
                  >
                    <span className="waiting-player-seat">0{index + 1}</span>
                    {player ? (
                      <>
                        <div className="waiting-player-avatar">
                          {player.username.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="waiting-player-info">
                          <strong>{player.username}</strong>
                          <span>
                            {player.isHost ? "Domaćin" : "Igrač"}
                            {" · "}Rejting {player.rating}
                          </span>
                        </div>
                        {isHost && !player.isHost && (
                          <button
                            className="waiting-player-remove"
                            type="button"
                            onClick={() => onKickPlayer(player.id)}
                            disabled={loading}
                            title={`Ukloni igrača ${player.username}`}
                            aria-label={`Ukloni igrača ${player.username}`}
                          >
                            ×
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="waiting-player-info">
                        <strong>Slobodno mjesto</strong>
                        <span>Čeka se igrač</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="waiting-room-start-row">
              {isHost ? (
                <button
                  className="primary-button waiting-room-start"
                  onClick={onStart}
                  disabled={
                    loading ||
                    !socketConnected ||
                    room.players.length !== room.maxPlayers
                  }
                >
                  {loading
                    ? "Pokretanje..."
                    : room.players.length === room.maxPlayers
                      ? "Pokreni partiju"
                      : `Čekaju se igrači (${room.players.length}/${room.maxPlayers})`}
                </button>
              ) : (
                <p className="waiting-room-wait-message">
                  Čeka se da domaćin pokrene partiju.
                </p>
              )}
            </div>
          </section>
        </section>

        <aside className="room-chat-panel waiting-room-chat">
          <div className="room-chat-header">
            <div>
              <span className="waiting-room-eyebrow">DOGOVORITE SE</span>
              <h2>Chat sobe</h2>
            </div>
            <span className="room-chat-live-dot" title="Chat uživo" />
          </div>

          <div className="room-chat-messages">
            {messages.length === 0 ? (
              <p className="room-chat-empty">Još nema poruka. Pozdravi ekipu.</p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.userId === userId
                      ? "room-chat-message self"
                      : "room-chat-message"
                  }
                >
                  <strong>{message.username}</strong>
                  <span>{message.message}</span>
                </div>
              ))
            )}
          </div>

          <div className="room-chat-input-row">
            <input
              type="text"
              value={chatInput}
              onChange={(event) => onChatInputChange(event.target.value)}
              placeholder="Napiši poruku..."
              maxLength={300}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSendChat();
                }
              }}
            />
            <button
              className="primary-button"
              onClick={onSendChat}
              type="button"
              aria-label="Pošalji poruku"
              title="Pošalji poruku"
            >
              ↑
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
