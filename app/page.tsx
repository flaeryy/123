
"use client";

import { useEffect, useRef, useState, useContext, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
import { io, type Socket } from "socket.io-client";
import { AppShellContext } from "./AppShellContext";
import GameTable, {
  type BelotCard,
  type BelotSuit,
  type PlayedCard,
} from "./components/game/GameTable";
import Lobby from "./components/lobby/Lobby";
import WaitingRoom from "./components/lobby/WaitingRoom";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleIdentityClient = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme: "outline";
      size: "large";
      text: "continue_with";
      shape: "rectangular";
      width: number;
      locale: "hr";
    },
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityClient;
      };
    };
  }
}


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
  phase: "dealing" | "trump_call" | "dealing_remaining" | "declarations" | "playing" | "round_finished" | "finished";
  trumpSuit: BelotSuit | null;
  trumpTurnPlayerNumber: 1 | 2 | 3 | 4;
  declarationTurnPlayerNumber: 1 | 2 | 3 | 4 | null;
  completedDeclarationPlayers: number[];
  roundNumber: number;
  dealerPlayerNumber: 1 | 2 | 3 | 4;
  team1MatchScore: number;
  team2MatchScore: number;
  matchWinnerTeam: 1 | 2 | null;
  team1DeclaredPoints: number;
  team2DeclaredPoints: number;
  activeDeclaration: {
    playerNumber: 1 | 2 | 3 | 4;
    cards: BelotCard[];
    points: number;
  } | null;
  finalScore: {
    team1: number;
    team2: number;
    winningTeam: 1 | 2 | null;
    declarationPoints: number;
  } | null;
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

type RoomChatMessage = {
  id: number;
  roomCode: string;
  userId: number | null;
  username: string;
  message: string;
  createdAt: string | Date;
};

function HomeContent() {
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [pendingBelaCard, setPendingBelaCard] = useState<BelotCard | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const autoJoinRoomCodeRef = useRef<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleInitializedRef = useRef(false);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);

  async function loginWithGoogle(credential: string) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = (await response.json()) as AuthResponse;

      if (!response.ok || !data.sessionToken || !data.user) {
        throw new Error(data.message ?? "Prijava putem Googlea nije uspjela.");
      }

      sessionStorage.setItem("belot_session", data.sessionToken);
      sessionStorage.setItem("belot_user", JSON.stringify(data.user));
      setUser(data.user);
      router.replace("/lobby");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Prijava putem Googlea nije uspjela.",
      );
    } finally {
      setLoading(false);
    }
  }

  function initializeGoogleButton() {
    const googleIdentity = window.google?.accounts.id;

    if (!GOOGLE_CLIENT_ID || !googleIdentity || !googleButtonRef.current) {
      return;
    }

    if (!googleInitializedRef.current) {
      googleIdentity.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response.credential) {
            void loginWithGoogle(response.credential);
          }
        },
      });
      googleInitializedRef.current = true;
    }

    googleButtonRef.current.replaceChildren();
    googleIdentity.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 320,
      locale: "hr",
    });
  }

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
    if (
      !user &&
      sessionStorage.getItem("belot_session") &&
      sessionStorage.getItem("belot_user")
    ) {
      return;
    }

    if (pathname === "/") {
      router.replace(user ? "/lobby" : "/login");
      return;
    }

    if (!user) {
      if (pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }

    if (pathname === "/login") {
      router.replace(currentRoom ? `/room/${currentRoom.code}` : "/lobby");
      return;
    }

    if (currentRoom && pathname === "/lobby") {
      router.replace(`/room/${currentRoom.code}`);
      return;
    }

    const roomRouteMatch = pathname.match(/^\/room\/([A-HJ-NP-Z2-9]{6})$/);

    if (roomRouteMatch && currentRoom && currentRoom.code !== roomRouteMatch[1]) {
      router.replace(`/room/${currentRoom.code}`);
    }
  }, [pathname, user, currentRoom, router]);

  useEffect(() => {
    if (!pathname.startsWith("/room/")) {
      autoJoinRoomCodeRef.current = null;
    }

    const roomRouteMatch = pathname.match(/^\/room\/([A-HJ-NP-Z2-9]{6})$/);
    const roomCodeFromRoute = roomRouteMatch?.[1];
    const socket = socketRef.current;

    if (
      !roomCodeFromRoute ||
      !user ||
      !socketConnected ||
      !socket ||
      currentRoom ||
      autoJoinRoomCodeRef.current === roomCodeFromRoute
    ) {
      return;
    }

    autoJoinRoomCodeRef.current = roomCodeFromRoute;
    setLoading(true);
    socket.emit(
      "join_room",
      { roomCode: roomCodeFromRoute },
      (response: RoomResponse) => {
        setLoading(false);

        if (!response.success || !response.room) {
          setError(response.message ?? "Ulazak u sobu nije uspio.");
          router.replace("/lobby");
          return;
        }

        setCurrentRoom(response.room);
        setError("");
      },
    );
  }, [pathname, user, socketConnected, currentRoom, router]);

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

    socket.on("room_chat_history", (messages: RoomChatMessage[]) => {
      setChatMessages([...messages].reverse());
    });

    socket.on("room_chat_message", (message: RoomChatMessage) => {
      setChatMessages((prev) => [...prev, message]);
    });

    socket.on("room_closed", () => {
      setCurrentRoom(null);
      setGameState(null);
      setGameStarted(false);
      setChatMessages([]);
      setChatInput("");
      setMessage("Soba je zatvorena.");
      router.replace("/lobby");
    });

    socket.on("player_kicked", (data: { message: string }) => {
      const roomCodeFromPath = window.location.pathname.match(
        /^\/room\/([A-HJ-NP-Z2-9]{6})$/,
      )?.[1];

      if (roomCodeFromPath) {
        autoJoinRoomCodeRef.current = roomCodeFromPath;
      }

      setCurrentRoom(null);
      setGameState(null);
      setGameStarted(false);
      setChatMessages([]);
      setChatInput("");
      setError("");
      setMessage(data.message);
      router.replace("/lobby");
    });

    socket.on(
      "game_aborted",
      (data: { room: Room; message: string }) => {
        setCurrentRoom(data.room);
        setGameState(null);
        setGameStarted(false);
        setError("");
        setMessage(data.message);
      },
    );

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
  }, [user, router]);

  function sendCardToServer(card: BelotCard) {
    const socket = socketRef.current;
    const currentGame = gameState;

    if (!socket) {
      alert("Nema veze s poslužiteljem.");
      return;
    }

    const currentPlayer = currentGame?.players.find(
      (player) => player.socketId === socket.id,
    );

    if (!currentGame || !currentPlayer) {
      return;
    }

    const mustConfirmBela =
      currentGame.trumpSuit !== null &&
      card.suit === currentGame.trumpSuit &&
      (card.rank === "K" || card.rank === "Q") &&
      currentPlayer.hand.some(
        (handCard) =>
          handCard.suit === currentGame.trumpSuit &&
          (handCard.rank === "K" || handCard.rank === "Q"),
      );

    if (mustConfirmBela) {
      setPendingBelaCard(card);
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

  function confirmBelaDecision(announceBela: boolean) {
    const socket = socketRef.current;
    const card = pendingBelaCard;

    if (!socket || !card) {
      return;
    }

    setPendingBelaCard(null);

    socket.emit(
      "play_card",
      { card, announceBela },
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

  function submitDeclarations(cards: BelotCard[]) {
    const socket = socketRef.current;

    if (!socket?.connected) {
      setError("Nisi povezan s poslužiteljem.");
      return;
    }

    setError("");
    socket.emit(
      "submit_declarations",
      { cards },
      (response: {
        success: boolean;
        accepted?: boolean;
        complete?: boolean;
        message?: string;
      }) => {
        if (!response.success) {
          setError(response.message ?? "Zvanje nije prihvaćeno.");
          return;
        }

        setMessage(
          response.complete
            ? "Sva zvanja su završena. Počinje igra."
            : response.accepted
              ? "Zvanje je prihvaćeno."
              : "Zvanje preskočeno.",
        );
      },
    );
  }

  function startNextDeal() {
    const socket = socketRef.current;

    if (!socket?.connected) {
      setError("Nisi povezan s poslužiteljem.");
      return;
    }

    setLoading(true);
    setError("");
    socket.emit(
      "start_next_deal",
      (response: { success: boolean; message?: string }) => {
        setLoading(false);

        if (!response.success) {
          setError(response.message ?? "Sljedeće dijeljenje nije pokrenuto.");
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
      router.replace("/login");
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
      router.replace("/lobby");
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
      router.replace("/login");
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
    setShowPassword(false);
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
        router.push(`/room/${response.room.code}`);
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
        router.push(`/room/${response.room.code}`);
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

        if (currentRoom) {
          autoJoinRoomCodeRef.current = currentRoom.code;
        }

        setCurrentRoom(null);
        setGameState(null);
        setGameStarted(false);
        setChatMessages([]);
        setChatInput("");
        setMessage("Napustio si sobu.");
        router.push("/lobby");
      },
    );
  }

  function kickRoomPlayer(playerSocketId: string) {
    const socket = socketRef.current;
    const target = currentRoom?.players.find(
      (player) => player.id === playerSocketId,
    );

    if (!socket?.connected || !currentRoom || !target) {
      setError("Igrača nije moguće ukloniti.");
      return;
    }

    if (!window.confirm(`Želiš li ukloniti igrača ${target.username} iz sobe?`)) {
      return;
    }

    setLoading(true);
    setError("");

    socket.timeout(5000).emit(
      "kick_player",
      { playerSocketId },
      (
        timeoutError: Error | null,
        response?: { success: boolean; message?: string },
      ) => {
        setLoading(false);

        if (timeoutError) {
          setError("Poslužitelj ne odgovara. Ponovno pokreni backend.");
          return;
        }

        if (!response?.success) {
          setError(response?.message ?? "Uklanjanje igrača nije uspjelo.");
          return;
        }

        setMessage(`${target.username} je uklonjen iz sobe.`);
      },
    );
  }

  function sendChatMessage() {
    const socket = socketRef.current;
    const cleanMessage = chatInput.trim();

    if (!socket?.connected || !cleanMessage) {
      return;
    }

    socket.emit(
      "room_chat_send",
      { message: cleanMessage },
      (response: { success: boolean; message?: string }) => {
        if (!response.success) {
          setError(response.message ?? "Slanje poruke nije uspjelo.");
          return;
        }

        setChatInput("");
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

  if (user && currentRoom && !gameStarted) {
    return (
      <WaitingRoom
        room={currentRoom}
        userId={user.id}
        loading={loading}
        socketConnected={socketConnected}
        error={error}
        notice={message}
        messages={chatMessages}
        chatInput={chatInput}
        onChatInputChange={setChatInput}
        onSendChat={sendChatMessage}
        onStart={startGame}
        onLeave={leaveRoom}
        onKickPlayer={kickRoomPlayer}
      />
    );
  }

  if (user && !currentRoom && !gameStarted) {
    return (
      <main className="lobby-dashboard">
        <header className="lobby-dashboard-topbar">
          <Link className="brand" href="/lobby">
            <span className="brand-mark">♠</span>
            <span>BELOT</span>
          </Link>

          <div className="lobby-account">
            <div className="lobby-account-avatar">
              {user.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="lobby-account-details">
              <strong>{user.username}</strong>
              <span>{socketConnected ? "Povezan" : "Povezivanje..."}</span>
            </div>
            <span className={socketConnected ? "online-dot" : "offline-dot"} />
            <button
              className="lobby-logout-button"
              type="button"
              onClick={handleLogout}
              disabled={loading}
              title="Odjavi se"
              aria-label="Odjavi se"
            >
              ↗
            </button>
          </div>
        </header>

        <div className="lobby-dashboard-content">
          <div className="lobby-dashboard-heading">
            <div>
              <span className="lobby-dashboard-eyebrow">IGRAĆI LOBBY</span>
              <h1>Sobe</h1>
            </div>
            <p>Dobro došao, {user.username}</p>
          </div>

          {error && <div className="message error" role="alert">{error}</div>}
          {message && <div className="message success" role="status">{message}</div>}

          {pathname.startsWith("/room/") ? (
            <section className="lobby-panel lobby-route-loading">
              <span className="lobby-panel-kicker">POZIVNICA</span>
              <h2>{loading ? "Soba se učitava..." : "Povezivanje sa sobom..."}</h2>
            </section>
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
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      {GOOGLE_CLIENT_ID && !user && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={initializeGoogleButton}
        />
      )}
      <header className="topbar">
        <Link className="brand" href={user ? "/lobby" : "/login"}>
          <span className="brand-mark">♠</span>
          <span>BELOT</span>
        </Link>
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
  <span className="suit-icon suit-spades" />
  <span className="suit-icon suit-hearts" />
  <span className="suit-icon suit-diamonds" />
  <span className="suit-icon suit-clubs" />
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
                    currentUserId={user.id}
                    messages={chatMessages}
                    chatInput={chatInput}
                    onChatInputChange={setChatInput}
                    onSendChat={sendChatMessage}
                    trump={gameState.trumpSuit}
                    team1Score={gameState.team1TrickPoints}
                    team2Score={gameState.team2TrickPoints}
                    phase={gameState.phase}
                    roundNumber={gameState.roundNumber}
                    team1MatchScore={gameState.team1MatchScore}
                    team2MatchScore={gameState.team2MatchScore}
                    matchWinnerTeam={gameState.matchWinnerTeam}
                    finalScore={gameState.finalScore}
                                        team1DeclarationPoints={gameState.team1DeclaredPoints}
                                        team2DeclarationPoints={gameState.team2DeclaredPoints}
                                        activeDeclaration={gameState.activeDeclaration}
                    canStartNextDeal={
                      gameState.phase === "round_finished" &&
                      currentRoom?.players.some(
                        (player) => player.userId === user.id && player.isHost,
                      ) === true
                    }
                    nextDealLoading={loading}
                    declarationTurnPlayerNumber={gameState.declarationTurnPlayerNumber}
                    completedDeclarationPlayers={gameState.completedDeclarationPlayers}
                    canDeclare={
                      gameState.phase === "declarations" &&
                      gameState.players.some(
                        (player) =>
                          player.socketId === socketRef.current?.id &&
                          player.playerNumber === gameState.declarationTurnPlayerNumber,
                      )
                    }
                    canPlay={
                      gameState.phase === "playing" &&
                      gameState.activeDeclaration === null &&
                      gameState.players.some(
                        (player) =>
                          player.socketId === socketRef.current?.id &&
                          player.playerNumber === gameState.currentPlayerNumber,
                      )
                    }
                    canChooseTrump={
                      gameState.phase === "trump_call" &&
                      gameState.activeDeclaration === null &&
                      gameState.players.some(
                        (player) =>
                          player.socketId === socketRef.current?.id &&
                          player.playerNumber === gameState.trumpTurnPlayerNumber,
                      )
                    }
                    trumpTurnPlayerNumber={gameState.trumpTurnPlayerNumber}
                    onPlayCard={sendCardToServer}
                    belaDecisionOpen={!!pendingBelaCard}
                    pendingBelaCard={pendingBelaCard}
                    onConfirmBela={confirmBelaDecision}
                    onChooseTrump={chooseTrumpOnServer}
                    onPassTrump={passTrumpOnServer}
                    onSubmitDeclarations={submitDeclarations}
                    onStartNextDeal={startNextDeal}
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
                  error={error}
                  notice={message}
                  messages={chatMessages}
                  chatInput={chatInput}
                  onChatInputChange={setChatInput}
                  onSendChat={sendChatMessage}
                  onStart={startGame}
                  onLeave={leaveRoom}
                  onKickPlayer={kickRoomPlayer}
                />
              ) : pathname.startsWith("/room/") ? (
                <div className="lobby-section">
                  <h3>{loading ? "Soba se učitava..." : "Povezivanje sa sobom..."}</h3>
                </div>
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
                  <span className="password-input-wrap">
                    <input
                      className="password-input"
                      type={showPassword ? "text" : "password"}
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
                    <button
                      className="password-visibility-button"
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                      aria-pressed={showPassword}
                      title={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                          <path d="M9.9 5.2A10.7 10.7 0 0112 5c6.5 0 10 7 10 7a15.7 15.7 0 01-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </span>
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

              {GOOGLE_CLIENT_ID && (
                <>
                  <div className="google-auth-divider">
                    <span />
                    <span>ILI NASTAVI S</span>
                    <span />
                  </div>
                  <div className="google-signin-button" ref={googleButtonRef} />
                </>
              )}

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

export default function Home() {
  const isPersistentShell = useContext(AppShellContext);

  return isPersistentShell ? <HomeContent /> : null;
}
