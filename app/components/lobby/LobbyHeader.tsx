"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "./LobbyHeader.css";

type LobbyHeaderProps = {
  username: string;
  socketConnected: boolean;
  loading: boolean;
  onLogout: () => void;
  onOpenProfile?: () => void;
};

export default function LobbyHeader({
  username,
  socketConnected,
  loading,
  onLogout,
  onOpenProfile,
}: LobbyHeaderProps) {
  const [avatarId, setAvatarId] = useState(1);

  useEffect(() => {
    let active = true;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    fetch(`${apiUrl}/profiles/by-name/${encodeURIComponent(username)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active && Number.isInteger(data?.profile?.avatarId)) setAvatarId(data.profile.avatarId);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [username]);

  return (
    <header className="belot-lobby-header">
      <div className="belot-lobby-header-inner">
        <Link href="/lobby" className="belot-header-brand">
          <div className="belot-header-logo" aria-hidden="true">
            <span className="belot-logo-card card-back">♥</span>
            <span className="belot-logo-card card-front">♣</span>
          </div>

          <div className="belot-header-brand-text">
            <strong>BELOT</strong>
            <small>Online kartaška igra</small>
          </div>
        </Link>

        <div className="belot-header-right">
          <div className="belot-header-user">
            <div className="belot-header-avatar">
              <img
                src={`/avatars/avatar-${String(avatarId).padStart(2, "0")}.png`}
                alt={`Avatar ${username}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            </div>

            <div className="belot-header-user-info">
              <button type="button" className="profile-name-button" onClick={onOpenProfile}><strong>{username}</strong></button>
              <span>
                <i
                  className={`belot-header-status ${
                    socketConnected ? "online" : "offline"
                  }`}
                />
                {socketConnected ? "Online" : "Povezivanje..."}
              </span>
            </div>
          </div>

          <div className="belot-header-divider" />

          <button
            type="button"
            className="belot-header-logout"
            onClick={onLogout}
            disabled={loading}
            title="Odjavi se"
            aria-label="Odjavi se"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
