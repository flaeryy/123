
"use client";

import "./ChatPanel.css";
import type { ChatMessage } from "./chat.types";

type ChatPanelProps = {
    messages: ChatMessage[];
    currentUserId?: number;
    input: string;
    onInputChange?: (value: string) => void;
    onSend?: () => void;
    variant?: "game" | "room";
    title?: string;
    eyebrow?: string;
    showLiveDot?: boolean;
    emptyMessage?: string;
};

export default function ChatPanel({
    messages,
    currentUserId,
    input,
    onInputChange,
    onSend,
    variant = "game",
    title = "CHAT SOBE",
    eyebrow,
    showLiveDot = false,
    emptyMessage = "Još nema poruka u ovoj partiji.",
}: ChatPanelProps) {
    return (
        <section
            className={
                variant === "room"
                    ? "room-chat-panel waiting-room-chat"
                    : "game-chat-panel"
            }
        >
            <div
                className={
                    variant === "room"
                        ? "room-chat-header"
                        : "game-chat-header"
                }
            >
                <div>
                    {eyebrow && <span className="waiting-room-eyebrow">{eyebrow}</span>}
                    {variant === "room" ? <h2>{title}</h2> : <h4>{title}</h4>}
                </div>

                {showLiveDot && <span className="room-chat-live-dot" title="Chat uživo" />}
            </div>

            <div
                className={
                    variant === "room"
                        ? "room-chat-messages"
                        : "game-chat-messages"
                }
            >
                {messages.length === 0 ? (
                    <p className={variant === "room" ? "room-chat-empty" : "game-chat-empty"}>
                        {emptyMessage}
                    </p>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={
                                message.userId === currentUserId
                                    ? variant === "room"
                                        ? "room-chat-message self"
                                        : "game-chat-message self"
                                    : variant === "room"
                                        ? "room-chat-message"
                                        : "game-chat-message"
                            }
                        >
                            <strong>{message.username}</strong>
                            <span>{message.message}</span>
                        </div>
                    ))
                )}
            </div>

            <div
                className={
                    variant === "room"
                        ? "room-chat-input-row"
                        : "game-chat-input-row"
                }
            >

            </div>

            <div className="game-chat-input-row">
                <input
                    type="text"
                    value={input}
                    onChange={(event) => onInputChange?.(event.target.value)}
                    placeholder="Napiši poruku..."
                    maxLength={300}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            onSend?.();
                        }
                    }}
                />

                <button
                    type="button"
                    className="primary-button"
                    onClick={onSend}
                    aria-label="Pošalji poruku"
                    title="Pošalji poruku"
                >
                    ↑
                </button>
            </div>
        </section>
    );
}
