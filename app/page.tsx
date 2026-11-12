
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import GameTable, {
  type BelotCard,
  type BelotSuit,
  type PlayedCard,
} from "./components/game/GameTable";
import Lobby from "./components/lobby/Lobby";
import WaitingRoom from "./components/lobby/WaitingRoom";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";


type ClientGamePlayer = {
  playerNumber: 1 | 2 | 3 | 4;
  socketId: string;
  username: string;
  team: 1 | 2;
  hand: BelotCard[];
  isDealer: boolean;
};

type ClientGameState = {
  roomCode: string;
  players: ClientGamePlayer[];
  phase: "dealing" | "trump_call" | "dealing_remaining" | "playing" | "finished";
  trumpSuit: BelotSuit | null;
  trumpTurnPlayerNumber: 1 | 2 | 3 | 4;
  currentPlayerNumber: number;
  currentTrick: PlayedCard[];
  team1TrickPoints: number;
  team2TrickPoints: number;
  myHand: BelotCard[];
};

type User = {
  id: number;
  username: string;
  email: string;
};

type AuthResponse = {
  success?: boolean;
  message?: string;
  sessionToken?: string;
  user?: User;
};

type Mode = "login" | "register";

type Player = {
  id: string;
  userId: number;
  username: string;
  isHost: boolean;
  rating: number;
};

type Room = {
  code: string;
  players: Player[];
  maxPlayers: 4;
  status: "waiting" | "playing";
  createdAt: string;
  isPublic: boolean;
  minRating: number;
};

type RoomResponse = {
  success: boolean;
  message?: string;
  room?: Room;
  rooms?: Room[];
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [socketConnected, setSocketConnected] = useState(false);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [minRating, setMinRating] = useState("0");
  const [gameStarted, setGameStarted] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);

  useEffect(() => {
    const savedToken = sessionStorage.getItem("belot_session");
    const savedUser = sessionStorage.getItem("belot_user");

    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser) as User);
      } catch {
        sessionStorage.removeItem("belot_session");
        sessionStorage.removeItem("belot_user");
      }
    }

    const params = new URLSearchParams(window.location.search);
    const verificationToken = params.get("token");

    if (verificationToken) {
      void verifyEmail(verificationToken);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const token = sessionStorage.getItem("belot_session");

    if (!token) {
      setError("Sesija nije pronađena. Prijavi se ponovno.");
      setUser(null);
      return;
    }

    const socket = io(API_URL, {
      auth: { token },
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      setError("");

      socket.emit(
        "get_public_rooms",
        (response: RoomResponse) => {
          if (response.success && response.rooms) {
            setPublicRooms(response.rooms);
          }
        },
      );
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("connect_error", (err) => {
      setSocketConnected(false);
      setError(err.message || "Povezivanje s poslužiteljem nije uspjelo.");
    });

    socket.on("public_rooms_updated", (rooms: Room[]) => {
      setPublicRooms(rooms);
    });

    socket.on("room_updated", (room: Room) => {
      setCurrentRoom(room);
    });

    socket.on("room_closed", () => {
      setCurrentRoom(null);
      setGameState(null);
      setGameStarted(false);
      setMessage("Soba je zatvorena.");
    });

    socket.on("game_started", (state: ClientGameState) => {
      setGameState(state);
      setGameStarted(true);
    });

    socket.on("game_state", (state: ClientGameState) => {
      setGameState(state);
      setGameStarted(true);
    });


    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [user]);

  function sendCardToServer(card: BelotCard) {
    const socket = socketRef.current;

    if (!socket) {
      alert("Nema veze s poslužiteljem.");
      return;
    }

    socket.emit(
      "play_card",
      { card, announceBela: false },
      (response: { success: boolean; message?: string }) => {
        if (!response?.success) {
          alert(response?.message ?? "Kartu nije moguće odigrati.");
        }
      },
    );
  }

  function chooseTrumpOnServer(trumpSuit: BelotSuit) {
    const socket = socketRef.current;

    if (!socket) return;

    socket.emit(
      "choose_trump",
      { trumpSuit },
      (response: { success: boolean; message?: string }) => {
        if (!response?.success) {
          alert(response?.message ?? "Odabir aduta nije uspio.");
        }
      },
    );
  }

  function passTrumpOnServer() {
    const socket = socketRef.current;

    if (!socket) return;

    socket.emit(
      "pass_trump",
      (response: { success: boolean; message?: string }) => {
        if (!response?.success) {
          alert(response?.message ?? "Prolaz nije uspio.");
        }
      },
    );
  }

  async function verifyEmail(token: string) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
      );

      const data = (await response.json()) as AuthResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Potvrda e-maila nije uspjela.");
      }

      setMode("login");
      setMessage("E-mail je potvrđen. Sada se možeš prijaviti.");
      window.history.replaceState({}, "", "/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Došlo je do pogreške.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const endpoint =
        mode === "login" ? "/auth/login" : "/auth/register";

      const body =
        mode === "login"
          ? { email, password }
          : { username, email, password };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as AuthResponse;

      if (!response.ok) {
        throw new Error(data.message ?? "Zahtjev nije uspio.");
      }

      if (mode === "register") {
        setMessage(
          data.message ??
          "Registracija je uspješna. Provjeri svoj e-mail.",
        );
        setPassword("");
        return;
      }

      if (!data.sessionToken || !data.user) {
        throw new Error("Server nije vratio podatke za prijavu.");
      }

      sessionStorage.setItem("belot_session", data.sessionToken);
      sessionStorage.setItem("belot_user", JSON.stringify(data.user));

      setUser(data.user);
      setPassword("");
      setMessage("");
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Došlo je do pogreške.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const token = sessionStorage.getItem("belot_session");

    setLoading(true);
    setError("");

    try {
      if (token) {
        const response = await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = (await response.json()) as AuthResponse;
          throw new Error(data.message ?? "Odjava nije uspjela.");
        }
      }

      sessionStorage.removeItem("belot_session");
      sessionStorage.removeItem("belot_user");

      socketRef.current?.disconnect();
      socketRef.current = null;

      setCurrentRoom(null);
      setPublicRooms([]);
      setGameState(null);
      setGameStarted(false);
      setUser(null);
      setMessage("Uspješno si se odjavio.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Došlo je do pogreške.",
      );
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
  }

  function createRoom() {
    const socket = socketRef.current;

    if (!socket?.connected) {
      setError("Nisi povezan s poslužiteljem.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    socket.emit(
      "create_room",
      {
        isPublic,
        minRating: Number(minRating),
      },
      (response: RoomResponse) => {
        setLoading(false);

        if (!response.success || !response.room) {
          setError(response.message ?? "Stvaranje sobe nije uspjelo.");
          return;
        }

        setCurrentRoom(response.room);
        setGameState(null);
        setGameStarted(false);
        setMessage("Soba je uspješno stvorena.");
      },
    );
  }

  function joinRoom(code?: string) {
    const socket = socketRef.current;
    const cleanCode = (code ?? roomCode).trim().toUpperCase();

    if (!socket?.connected) {
      setError("Nisi povezan s poslužiteljem.");
      return;
    }

    if (!cleanCode) {
      setError("Unesi kod sobe.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    socket.emit(
      "join_room",
      { roomCode: cleanCode },
      (response: RoomResponse) => {
        setLoading(false);

        if (!response.success || !response.room) {
          setError(response.message ?? "Ulazak u sobu nije uspio.");
          return;
        }

        setCurrentRoom(response.room);
        setGameState(null);
        setGameStarted(false);
        setRoomCode("");
      },
    );
  }

  function leaveRoom() {
    const socket = socketRef.current;

    if (!socket?.connected) {
      setError("Nisi povezan s poslužiteljem.");
      return;
    }

    setLoading(true);
    setError("");

    socket.emit(
      "leave_room",
      (response: RoomResponse) => {
        setLoading(false);

        if (!response.success) {
          setError(response.message ?? "Napuštanje sobe nije uspjelo.");
          return;
        }

        setCurrentRoom(null);
        setGameState(null);
        setGameStarted(false);
        setMessage("Napustio si sobu.");
      },
    );
  }

  function startGame() {
    const socket = socketRef.current;

    if (!socket?.connected) {
      setError("Nisi povezan s poslužiteljem.");
      return;
    }

    setLoading(true);
    setError("");

    socket.emit(
      "start_game",
      (response: RoomResponse) => {
        setLoading(false);

        if (!response.success) {
          setError(response.message ?? "Pokretanje partije nije uspjelo.");
          return;
        }

        if (response.room) {
          setCurrentRoom(response.room);
        }

        // Prikaz partije pokreće događaj game_started s početnim stanjem.
      },
    );
  }

  function renderRoom(room: Room) {
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
          onClick={() => joinRoom(room.code)}
          disabled={loading || !!currentRoom}
        >
          Pridruži se
        </button>
      </div>
    );
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">♠</span>
          <span>BELOT</span>
        </a>
        <span className="topbar-label">HRVATSKI KLASIČNI BELOT</span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            IGRAJ S PRIJATELJIMA
          </div>

          <h1>
            Karte na stol.
            <br />
            <span>Ekipa na okupu.</span>
          </h1>

          <p className="hero-description">
            Okupi četiri igrača, odaberi svoju sobu i pokaži tko
            najbolje poznaje Belot.
          </p>

          <div className="suit-decoration" aria-hidden="true">
            <span>♠</span>
            <span>♥</span>
            <span>♦</span>
            <span>♣</span>
          </div>

          <div className="hero-note">
            <span className="note-line" />
            KLASIČNI BELOT · 4 IGRAČA · DVA PARA
          </div>
        </div>

        <div className="auth-panel">
          {user ? (
            <div className="logged-in">
              <div className="panel-symbol">♠</div>
              <div className="panel-kicker">IGRAĆI LOBBY</div>

              <h2>Bok, {user.username}!</h2>

              <div className="user-card">
                <div className="avatar">
                  {user.username.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong>{user.username}</strong>
                  <span>{user.email}</span>
                </div>
                <span
                  className={socketConnected ? "online-dot" : "offline-dot"}
                />
              </div>

              <p className="connection-status">
                {socketConnected
                  ? "Povezan s poslužiteljem"
                  : "Povezivanje s poslužiteljem..."}
              </p>

              {error && <div className="message error">{error}</div>}
              {message && <div className="message success">{message}</div>}


              {gameStarted ? (
                gameState ? (
                  <GameTable
                    players={gameState.players.map((player) => ({
                      id: player.socketId,
                      username: player.username,
                      seat: (player.playerNumber - 1) as 0 | 1 | 2 | 3,
                    }))}
                    hand={gameState.myHand}
                    playedCards={gameState.currentTrick}
                    currentPlayerId={
                      gameState.players.find(
                        (player) =>
                          player.playerNumber === gameState.currentPlayerNumber,
                      )?.socketId ?? null
                    }
                    viewerId={socketRef.current?.id ?? ""}
                    trump={gameState.trumpSuit}
                    team1Score={gameState.team1TrickPoints}
                    team2Score={gameState.team2TrickPoints}
                    phase={gameState.phase}
                    canPlay={
                      gameState.phase === "playing" &&
                      gameState.players.some(
                        (player) =>
                          player.socketId === socketRef.current?.id &&
                          player.playerNumber === gameState.currentPlayerNumber,
                      )
                    }
                    canChooseTrump={
                      gameState.phase === "trump_call" &&
                      gameState.players.some(
                        (player) =>
                          player.socketId === socketRef.current?.id &&
                          player.playerNumber === gameState.trumpTurnPlayerNumber,
                      )
                    }
                    trumpTurnPlayerNumber={gameState.trumpTurnPlayerNumber}
                    onPlayCard={sendCardToServer}
                    onChooseTrump={chooseTrumpOnServer}
                    onPassTrump={passTrumpOnServer}
                  />
                ) : (
                  <div className="lobby-section">
                    <h3>Partija se učitava...</h3>
                  </div>
                )
              ) : currentRoom ? (
                <WaitingRoom
                  room={currentRoom}
                  userId={user.id}
                  loading={loading}
                  socketConnected={socketConnected}
                  onStart={startGame}
                  onLeave={leaveRoom}
                />
              ) : (
                <Lobby
                  publicRooms={publicRooms}
                  loading={loading}
                  socketConnected={socketConnected}
                  currentRoomExists={!!currentRoom}
                  isPublic={isPublic}
                  minRating={minRating}
                  roomCode={roomCode}
                  onPublicChange={setIsPublic}
                  onMinRatingChange={setMinRating}
                  onRoomCodeChange={setRoomCode}
                  onCreateRoom={createRoom}
                  onJoinRoom={joinRoom}
                />
              )}

              <button
                className="secondary-button"
                onClick={handleLogout}
                disabled={loading}
              >
                Odjavi se
              </button>
            </div>
          ) : (
            <>
              <div className="panel-symbol">♠</div>
              <div className="panel-kicker">TVOJA IGRA POČINJE OVDJE</div>

              <h2>
                {mode === "login"
                  ? "Dobro nam došao."
                  : "Pridruži se igri."}
              </h2>

              <p className="panel-description">
                {mode === "login"
                  ? "Prijavi se i vrati se za stol."
                  : "Izradi račun i zaigraj s prijateljima."}
              </p>

              <div className="auth-tabs">
                <button
                  className={mode === "login" ? "active" : ""}
                  onClick={() => changeMode("login")}
                  type="button"
                >
                  Prijava
                </button>
                <button
                  className={mode === "register" ? "active" : ""}
                  onClick={() => changeMode("register")}
                  type="button"
                >
                  Registracija
                </button>
              </div>

              <form onSubmit={handleSubmit} className="auth-form">
                {mode === "register" && (
                  <label>
                    KORISNIČKO IME
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
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
                    onChange={(event) => setEmail(event.target.value)}
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
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Unesi lozinku"
                    minLength={8}
                    maxLength={128}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
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

                <button
                  className="primary-button"
                  type="submit"
                  disabled={loading}
                >
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
          )}
        </div>
      </section>

      <footer className="footer">
        <span>BELOT ONLINE</span>
        <span>ČETIRI IGRAČA. DVA PARA. JEDNA POBJEDA.</span>
      </footer>
    </main>
  );
}
