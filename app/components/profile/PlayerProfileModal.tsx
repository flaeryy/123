"use client";

import { useEffect, useState } from "react";
import "./PlayerProfileModal.css";

type Profile = {
  id: number;
  username: string;
  createdAt: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  avatarId: number;
  bestWinStreak: number;
  winRate: number;
};

type Props = {
  userId?: number;
  username?: string;
  myUserId: number;
  apiUrl: string;
  onClose: () => void;
};

export default function PlayerProfileModal({ userId, username, myUserId, apiUrl, onClose }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setError("");
    setEditing(false);
    fetch(userId !== undefined ? `${apiUrl}/profiles/${userId}` : `${apiUrl}/profiles/by-name/${encodeURIComponent(username ?? "")}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Profil nije dostupan.");
        return response.json();
      })
      .then((data) => { if (active) setProfile(data.profile); })
      .catch(() => { if (active) setError("Ne mogu dohvatiti profil igrača."); });
    return () => { active = false; };
  }, [apiUrl, userId, username]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function chooseAvatar(avatarId: number) {
    const token = sessionStorage.getItem("belot_session");
    if (!token || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/profiles/me/avatar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarId }),
      });
      if (!response.ok) throw new Error("Spremanje avatara nije uspjelo.");
      setProfile((current) => current ? { ...current, avatarId } : current);
      setEditing(false);
    } catch {
      setError("Nije moguće spremiti avatar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-label="Profil igrača">
        <header className="profile-modal-header">
          <h2>Profil igrača</h2>
          <button type="button" onClick={onClose} aria-label="Zatvori profil">×</button>
        </header>
        {error && <p className="profile-error" role="alert">{error}</p>}
        {!profile && !error && <p>Učitavanje profila...</p>}
        {profile && (
          <>
            <div className="profile-identity">
              <img src={`/avatars/avatar-${String(profile.avatarId).padStart(2, "0")}.png`} alt="Avatar igrača" />
              <div>
                <h3>{profile.username}</h3>
                <p>★ Rejting {profile.rating} / 10</p>
                <small>Član od {new Date(profile.createdAt).toLocaleDateString("hr-HR")}</small>
              </div>
              {profile.id === myUserId && (
                <button className="profile-edit" type="button" onClick={() => setEditing(!editing)}>
                  {editing ? "Odustani" : "Promijeni avatar"}
                </button>
              )}
            </div>
            {editing && userId === myUserId && (
              <div className="profile-avatar-grid" aria-label="Odabir avatara">
                {Array.from({ length: 12 }, (_, index) => index + 1).map((id) => (
                  <button key={id} type="button" disabled={saving}
                    className={profile.avatarId === id ? "selected" : ""}
                    onClick={() => void chooseAvatar(id)} aria-label={`Odaberi avatar ${id}`}>
                    <img src={`/avatars/avatar-${String(id).padStart(2, "0")}.png`} alt="" />
                  </button>
                ))}
              </div>
            )}
            <div className="profile-stats">
              <div><strong>{profile.gamesPlayed}</strong><span>Partija</span></div>
              <div><strong>{profile.wins}</strong><span>Pobjeda</span></div>
              <div><strong>{profile.losses}</strong><span>Poraza</span></div>
            </div>
            <div className="profile-stat-line"><span>Uspješnost</span><strong>{profile.winRate.toLocaleString("hr-HR")} %</strong></div>
            <div className="profile-progress"><div style={{ width: `${Math.min(100, Math.max(0, profile.winRate))}%` }} /></div>
            <div className="profile-stat-line"><span>Najviše pobjeda zaredom</span><strong>{profile.bestWinStreak}</strong></div>
          </>
        )}
      </section>
    </div>
  );
}
