"use client";

import type { FormEvent } from "react";
import type { Mode } from "../../types/belot";

type AuthFormProps = {
  mode: Mode;
  username: string;
  email: string;
  password: string;
  loading: boolean;
  message: string;
  error: string;
  onModeChange: (mode: Mode) => void;
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function AuthForm({
  mode,
  username,
  email,
  password,
  loading,
  message,
  error,
  onModeChange,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AuthFormProps) {
  return (
    <>
      <div className="panel-symbol">♠</div>
      <div className="panel-kicker">TVOJA IGRA POČINJE OVDJE</div>

      <h2>
        {mode === "login" ? "Dobro nam došao." : "Pridruži se igri."}
      </h2>

      <p className="panel-description">
        {mode === "login"
          ? "Prijavi se i vrati se za stol."
          : "Izradi račun i zaigraj s prijateljima."}
      </p>

      <div className="auth-tabs">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => onModeChange("login")}
          type="button"
        >
          Prijava
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => onModeChange("register")}
          type="button"
        >
          Registracija
        </button>
      </div>

      <form onSubmit={onSubmit} className="auth-form">
        {mode === "register" && (
          <label>
            KORISNIČKO IME
            <input
              type="text"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="Npr. BelotIgrac"
              minLength={3}
              maxLength={30}
              autoComplete="username"
              required
            />
          </label>
        )}

        <label>
          E-MAIL ADRESA
          <input
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="ime@email.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          LOZINKA
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Unesi lozinku"
            minLength={8}
            maxLength={128}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>

        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="message success" role="status">
            {message}
          </div>
        )}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading
            ? "Molimo pričekaj..."
            : mode === "login"
              ? "Prijavi se"
              : "Izradi račun"}
          {!loading && <span>→</span>}
        </button>
      </form>

      <p className="terms-note">
        {mode === "login"
          ? "Nemaš račun? Odaberi registraciju iznad."
          : "Registracijom potvrđuješ da želiš igrati po pravilima Belota."}
      </p>
    </>
  );
}
