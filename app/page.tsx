"use client";

import { useEffect, useRef, useState, useContext, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
//import { io, type Socket } from "socket.io-client";
import { AppShellContext } from "./AppShellContext";
import GameTable, {
  type BelotCard,
  type BelotSuit,
  type PlayedCard,
} from "./components/game/GameTable";
import Lobby from "./components/lobby/Lobby";
import WaitingRoom, {
  type AvailablePlayer,
} from "./components/lobby/WaitingRoom";
import { useRoomChat } from "./hooks/useRoomChat";
import { useSocket } from "./hooks/useSocket";
import { useAuth } from "./hooks/useAuth";
import RoomCard from "./components/lobby/RoomCard";
import LobbyHeader from "./components/lobby/LobbyHeader";
import PlayerProfileModal from "./components/profile/PlayerProfileModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
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
  sameIpWarning?: boolean;
};

type ClientGameState = {
  roomCode: string;
  players: ClientGamePlayer[];
  phase:
    | "dealing"
    | "trump_call"
    | "dealing_remaining"
    | "declarations"
    | "playing"
    | "round_finished"
    | "finished";
  trumpSuit: BelotSuit | null;
  trumpTurnPlayerNumber: 1 | 2 | 3 | 4;
  declarationTurnPlayerNumber: 1 | 2 | 3 | 4 | null;
  completedDeclarationPlayers: number[];
  roundNumber: number;
  dealerPlayerNumber: 1 | 2 | 3 | 4;
  team1MatchScore: number;
  team2MatchScore: number;
  roundHistory: {
    roundNumber: number;
    team1: number;
    team2: number;
  }[];
  matchWinnerTeam: 1 | 2 | null;
  team1DeclaredPoints: number;
  team2DeclaredPoints: number;
  team1Bela: number;
  team2Bela: number;
  activeDeclarations: {
    playerNumber: 1 | 2 | 3 | 4;
    cards: BelotCard[];
    points: number;
  }[];
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
  seat: 1 | 2 | 3 | 4;
  sameIpWarning?: boolean;
};

type Room = {
  code: string;
  players: Player[];
  maxPlayers: 4;
  status: "waiting" | "playing";
  createdAt: string;
  isPublic: boolean;
  minRating: number;
  turnDuration: 15 | 30 | 45;
  gameType: "prolaz" | "dosta";
  targetScore: 501 | 701 | 1001;
};

type RoomResponse = {
  success: boolean;
  message?: string;
  room?: Room;
  rooms?: Room[];
};

function HomeContent() {
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [authReady, setAuthReady] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>(
    [],
  );
  const [roomInvite, setRoomInvite] = useState<{
    roomCode: string;
    hostName: string;
  } | null>(null);
  const [pendingInviteIds, setPendingInviteIds] = useState<number[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [minRating, setMinRating] = useState("0");
  const [gameStarted, setGameStarted] = useState(false);
  const [gameNotice, setGameNotice] = useState<{ message: string } | null>(null);
  useEffect(() => {
    if (!gameNotice) return;
    const timeout = window.setTimeout(() => setGameNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [gameNotice]);
  useEffect(() => {
    if (!gameStarted) setGameNotice(null);
  }, [gameStarted]);
  function showGameNotice(message: string) {
    setGameNotice({ message: message === "Ta karta nije dozvoljena." ? "Tu kartu trenutačno ne možeš odigrati." : message });
  }
  // Upravljanje Socket.IO vezom izdvojeno je u zaseban hook.
  const [profileTarget, setProfileTarget] = useState<{ userId?: number; username?: string } | null>(null);
  const { socketRef, socketConnected } = useSocket(user, API_URL);
  const { logout, restoreSession } = useAuth(API_URL);

  const {
    chatMessages,
    chatInput,
    setChatInput,
    sendChatMessage,
    registerChatListeners,
    clearChat,
  } = useRoomChat(socketRef, setError, user?.id ?? null);
  const [pendingBelaCard, setPendingBelaCard] = useState<BelotCard | null>(
    null,
  );
  const [belaDecisionMade, setBelaDecisionMade] = useState(false);
  // Pamtimo zadnju rundu za koju smo pustili zvuk, da Socket.IO update
  // ne pokrene mijesanje vise puta.
  const lastShuffleRoundRef = useRef<number | null>(null);
  const shuffleAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoJoinRoomCodeRef = useRef<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleInitializedRef = useRef(false);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [trickCollectWinner, setTrickCollectWinner] = useState<number | null>(
    null,
  );

  // Dohvat javnih soba za prijavljene i neprijavljene korisnike.
  useEffect(() => {
    if (pathname !== "/") return;

    const fetchPublicRooms = async () => {
      try {
        const response = await fetch(`${API_URL}/rooms/public`);

        if (!response.ok) {
          throw new Error("Dohvat soba nije uspio.");
        }

        const data: RoomResponse = await response.json();

        if (data.success && data.rooms) {
          setPublicRooms(data.rooms);
        }
      } catch (error) {
        console.error("Greška pri dohvatu javnih soba:", error);
      }
    };

    void fetchPublicRooms();

    const interval = window.setInterval(() => {
      void fetchPublicRooms();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [pathname]);

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
    const restoredUser = restoreSession();

    if (restoredUser) {
      setUser(restoredUser);
    }

    setAuthReady(true); // NOVO

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
      return;
    }
    if (!user) {
      if (pathname !== "/login" && pathname !== "/") {
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

    if (
      roomRouteMatch &&
      currentRoom &&
      currentRoom.code !== roomRouteMatch[1]
    ) {
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
    const socket = socketRef.current;

    if (!user || !socket) {
      return;
    }

    // Registracija listenera za chat.
    const cleanupChatListeners = registerChatListeners(socket);

    // Uspješno povezivanje.
    function handleConnect() {
      setError("");

      socket!.emit(
        "get_available_players",
        (response: { success: boolean; players?: AvailablePlayer[] }) => {
          if (response.success) setAvailablePlayers(response.players ?? []);
        },
      );
      socket!.emit("get_public_rooms", (response: RoomResponse) => {
        if (response.success && response.rooms) {
          setPublicRooms(response.rooms);
        }
      });
    }

    // Greška prilikom povezivanja.
    function handleConnectError(err: Error) {
      setError(err.message || "Povezivanje s poslužiteljem nije uspjelo.");
    }

    // Ažuriranje javnih soba.
    function handlePublicRoomsUpdated(rooms: Room[]) {
      setPublicRooms(rooms);
    }

    // Ažuriranje trenutne sobe.
    function handleRoomUpdated(room: Room) {
      setCurrentRoom(room);
    }

    // Soba je zatvorena.
    function handleRoomClosed(data?: { message?: string }) {
      setCurrentRoom(null);
      setGameState(null);
      setGameStarted(false);
      clearChat();
      setMessage(data?.message ?? "Soba je zatvorena.");
      router.replace("/lobby");
    }

    // Igrač je izbačen iz sobe.
    function handlePlayerKicked(data: { message: string }) {
      const roomCodeFromPath = window.location.pathname.match(
        /^\/room\/([A-HJ-NP-Z2-9]{6})$/,
      )?.[1];

      if (roomCodeFromPath) {
        autoJoinRoomCodeRef.current = roomCodeFromPath;
      }

      setCurrentRoom(null);
      setGameState(null);
      setGameStarted(false);
      clearChat();
      setError("");
      setMessage(data.message);
      router.replace("/lobby");
    }

    // Zavrsen mec: rezultat se prikazuje prije povratka u lobby.
    function handleMatchFinished(data: {
      winnerTeam: 1 | 2;
      team1Score: number;
      team2Score: number;
    }) {
      setGameStarted(false);
      setGameState(null);
      setCurrentRoom(null);
      setTrickCollectWinner(null);
      clearChat();
      setError("");
      setMessage(
        `Pobjednik je ekipa ${data.winnerTeam === 1 ? "1 (igraci 1 i 3)" : "2 (igraci 2 i 4)"}! Rezultat: ${data.team1Score} : ${data.team2Score}.`,
      );
      router.replace("/lobby");
    }

    // Partija je prekinuta.
    function handleGameAborted(data: { room: Room; message: string }) {
      setCurrentRoom(data.room);
      setGameState(null);
      setGameStarted(false);
      setError("");
      setMessage(data.message);
    }

    // Početak partije.
    function handleGameStarted(state: ClientGameState) {
      setGameState(state);
      setGameStarted(true);
    }

    // Ažuriranje stanja partije.
    function handleGameState(state: ClientGameState) {
      if (state.currentTrick.length !== 4) setTrickCollectWinner(null);
      setGameState(state);
      setGameStarted(true);
    }

    function handleTrickCollect(data: { winnerPlayerNumber: number }) {
      setTrickCollectWinner(data.winnerPlayerNumber);
    }

    function handleAvailablePlayers(players: AvailablePlayer[]) {
      setAvailablePlayers(players);
    }
    function handleRoomInvite(invite: { roomCode: string; hostName: string }) {
      setRoomInvite(invite);
    }
    function handleInviteStatus(data: {
      targetUserId: number;
      status: string;
    }) {
      setPendingInviteIds((ids) =>
        ids.filter((id) => id !== data.targetUserId),
      );
      if (data.status === "declined") setMessage("Igrač je odbio pozivnicu.");
      if (data.status === "expired") setMessage("Pozivnica je istekla.");
    }

    // Registracija svih Socket.IO događaja.
    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("public_rooms_updated", handlePublicRoomsUpdated);
    socket.on("available_players_updated", handleAvailablePlayers);
    socket.on("room_invite", handleRoomInvite);
    socket.on("room_invite_status", handleInviteStatus);
    socket.on("room_updated", handleRoomUpdated);
    socket.on("room_closed", handleRoomClosed);
    socket.on("player_kicked", handlePlayerKicked);
    socket.on("game_aborted", handleGameAborted);
    socket.on("game_started", handleGameStarted);
    socket.on("game_state", handleGameState);
    socket.on("match_finished", handleMatchFinished);
    socket.on("trick_collect", handleTrickCollect);

    // Vezu pokrećemo tek nakon registracije svih listenera.
    socket.connect();

    // Uklanjanje listenera.
    return () => {
      cleanupChatListeners();

      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("public_rooms_updated", handlePublicRoomsUpdated);
      socket.off("available_players_updated", handleAvailablePlayers);
      socket.off("room_invite", handleRoomInvite);
      socket.off("room_invite_status", handleInviteStatus);
      socket.off("room_updated", handleRoomUpdated);
      socket.off("room_closed", handleRoomClosed);
      socket.off("player_kicked", handlePlayerKicked);
      socket.off("game_aborted", handleGameAborted);
      socket.off("game_started", handleGameStarted);
      socket.off("game_state", handleGameState);
      socket.off("match_finished", handleMatchFinished);
      socket.off("trick_collect", handleTrickCollect);
    };
  }, [user, router, registerChatListeners, clearChat]);

  // Na zavrsetku dijeljenja pustamo oko 2 sekunde mijesanja karata.
  // Server vec ima pauzu od 3 sekunde prije sljedeceg dijeljenja.
  useEffect(() => {
    if (!gameStarted || gameState?.phase !== "round_finished") return;
    if (lastShuffleRoundRef.current === gameState.roundNumber) return;
    lastShuffleRoundRef.current = gameState.roundNumber;

    const audio = new Audio("/sound/mjesanje_sound.mp3");
    audio.volume = 0.65;
    shuffleAudioRef.current?.pause();
    shuffleAudioRef.current = audio;
    // Preglednik moze blokirati zvuk dok korisnik prvi put ne klikne na stranicu.
    void audio.play().catch(() => {});
    const stopSound = window.setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, 2000);
    return () => {
      window.clearTimeout(stopSound);
      audio.pause();
    };
  }, [gameStarted, gameState?.phase, gameState?.roundNumber]);

  function sendCardToServer(card: BelotCard) {
    const socket = socketRef.current;
    const currentGame = gameState;

    if (!socket) {
      showGameNotice("Nema veze s poslužiteljem.");
      return;
    }

    const currentPlayer = currentGame?.players.find(
      (player) => player.socketId === socket.id,
    );

    if (!currentGame || !currentPlayer) {
      return;
    }

    const hasTrumpKing = currentPlayer.hand.some(
      (handCard) =>
        handCard.suit === currentGame.trumpSuit && handCard.rank === "K",
    );

    const hasTrumpQueen = currentPlayer.hand.some(
      (handCard) =>
        handCard.suit === currentGame.trumpSuit && handCard.rank === "Q",
    );

    const mustConfirmBela =
      currentGame.trumpSuit !== null &&
      card.suit === currentGame.trumpSuit &&
      (card.rank === "K" || card.rank === "Q") &&
      hasTrumpKing &&
      hasTrumpQueen;

    if (mustConfirmBela) {
      // Ne prikazuj pitanje za belu dok server ne potvrdi legalnost karte.
      socket.emit(
        "validate_card",
        { card },
        (response: { success: boolean; message?: string }) => {
          if (!response?.success) {
            showGameNotice(response?.message ?? "Ta karta nije dozvoljena.");
            return;
          }
          setPendingBelaCard(card);
        },
      );
      return;
    }

    socket.emit(
      "play_card",
      { card, announceBela: false },
      (response: { success: boolean; message?: string }) => {
        if (!response?.success) {
          showGameNotice(response?.message ?? "Kartu nije moguće odigrati.");
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

    setBelaDecisionMade(true);

    setPendingBelaCard(null);

    socket.emit(
      "play_card",
      { card, announceBela },
      (response: { success: boolean; message?: string }) => {
        if (!response?.success) {
          showGameNotice(response?.message ?? "Kartu nije moguće odigrati.");
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
          showGameNotice(response?.message ?? "Odabir aduta nije uspio.");
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
          showGameNotice(response?.message ?? "Prolaz nije uspio.");
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

    setBelaDecisionMade(false);
    setPendingBelaCard(null);

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
      setError(err instanceof Error ? err.message : "Došlo je do pogreške.");
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
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";

      const body =
        mode === "login" ? { email, password } : { username, email, password };

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
          data.message ?? "Registracija je uspješna. Provjeri svoj e-mail.",
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
      setError(err instanceof Error ? err.message : "Došlo je do pogreške.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setError("");

    try {
      await logout();

      setCurrentRoom(null);
      setPublicRooms([]);
      setGameState(null);
      setGameStarted(false);
      setUser(null);
      setMessage("Uspješno si se odjavio.");
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Došlo je do pogreške.");
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

  function createRoom(settings: {
    turnDuration: 15 | 30 | 45;
    gameType: "prolaz" | "dosta";
    targetScore: 501 | 701 | 1001;
  }) {
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
        ...settings,
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

  function invitePlayer(targetUserId: number) {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    setPendingInviteIds((ids) =>
      ids.includes(targetUserId) ? ids : [...ids, targetUserId],
    );
    socket.emit(
      "invite_room_player",
      { targetUserId },
      (response: { success: boolean; message?: string }) => {
        if (response.success) setMessage("Pozivnica je poslana.");
        else {
          setPendingInviteIds((ids) => ids.filter((id) => id !== targetUserId));
          setError(response.message ?? "Slanje pozivnice nije uspjelo.");
        }
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
      setError("Unesi šifru sobe.");
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

    socket.emit("leave_room", (response: RoomResponse) => {
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
      clearChat();
      setMessage("Napustio si sobu.");
      router.push("/lobby");
    });
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

    if (
      !window.confirm(`Želiš li ukloniti igrača ${target.username} iz sobe?`)
    ) {
      return;
    }

    setLoading(true);
    setError("");

    socket
      .timeout(5000)
      .emit(
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

  function swapRoomPlayers(firstSeat: number, secondSeat: number) {
    const socket = socketRef.current;

    if (!socket?.connected || !currentRoom) {
      setError("Nisi povezan sa sobom.");
      return;
    }

    setLoading(true);
    setError("");

    socket
      .timeout(5000)
      .emit(
        "swap_players",
        { firstSeat, secondSeat },
        (
          timeoutError: Error | null,
          response?: { success: boolean; message?: string },
        ) => {
          setLoading(false);

          if (timeoutError) {
            setError("Poslužitelj ne odgovara.");
            return;
          }

          if (!response?.success) {
            setError(response?.message ?? "Promjena mjesta nije uspjela.");
            return;
          }

          setMessage("Mjesta igrača uspješno su zamijenjena.");
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

    socket.emit("start_game", (response: RoomResponse) => {
      setLoading(false);

      if (!response.success) {
        setError(response.message ?? "Pokretanje partije nije uspjelo.");
        return;
      }

      if (response.room) {
        setCurrentRoom(response.room);
      }

      // Prikaz partije pokreće događaj game_started s početnim stanjem.
    });
  }

  // Jedan popup profila koristimo u lobbyju, cekaonici i tijekom igre.
  function withProfile(content: ReactNode) {
    return (
      <>
        {content}
        {profileTarget && user && (
          <PlayerProfileModal
            userId={profileTarget.userId}
            username={profileTarget.username}
            myUserId={user.id}
            apiUrl={API_URL}
            onClose={() => setProfileTarget(null)}
          />
        )}
      </>
    );
  }

  if (!authReady) {
    return null;
  }
  if (pathname === "/") {
    return withProfile(
      <main className="belot-home">
        <header className="belot-home-header">
          <Link href="/" className="belot-home-logo">
            <span className="belot-home-logo-icon">♣</span>
            <strong>BELOT</strong>
          </Link>

          <div className="belot-home-header-actions">
            {user ? (
              <Link href="/lobby" className="belot-home-profile-link">
                <span className="belot-home-small-avatar">
                  {user.username.charAt(0).toUpperCase()}
                </span>
                <span>{user.username}</span>
              </Link>
            ) : (
              <Link href="/login" className="belot-home-login">
                Prijavi se
              </Link>
            )}
          </div>
        </header>

        <div className="belot-home-content">
          {user ? (
            <section className="belot-home-user-card">
              <div className="belot-home-avatar">
                {user.username.charAt(0).toUpperCase()}
              </div>

              <div className="belot-home-user-info">
                <strong>{user.username}</strong>
                <span>Belot igrač</span>
              </div>

              <div className="belot-home-online">
                <span className="belot-home-online-dot" />
                {socketConnected ? "Online" : "Povezivanje..."}
              </div>
            </section>
          ) : (
            <section className="belot-home-guest-card">
              <div className="belot-home-avatar">♣</div>

              <div className="belot-home-user-info">
                <strong>Dobro došao u Belot!</strong>
                <span>Prijavi se za pristup sobama i igri.</span>
              </div>

              <Link href="/login" className="belot-home-login">
                Prijavi se
              </Link>
            </section>
          )}

          <section className="belot-home-rooms">
            <div className="belot-home-rooms-header">
              <h2>Lista slobodnih igara</h2>
              {user && <span>{publicRooms.length}</span>}
            </div>

            <div className="belot-home-rooms-content">
              {publicRooms.length === 0 ? (
                <div className="belot-home-rooms-notice">
                  <p>Trenutno nema slobodnih soba.</p>
                </div>
              ) : (
                <div className="belot-home-room-list">
                  {publicRooms.map((room) => (
                    <RoomCard
                      key={`${room.code}-${room.players[0]?.id ?? ""}`}
                      room={room}
                      loading={loading}
                      disabled={!!currentRoom}
                      onJoin={(code) => {
                        if (!user) {
                          router.push("/login");
                          return;
                        }

                        joinRoom(code);
                      }}
                      onPrivateJoin={() => {
                        router.push(user ? "/lobby" : "/login");
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {user && (
            <Link href="/lobby" className="belot-home-enter">
              Uđi u lobby
            </Link>
          )}
        </div>
      </main>
    );
  }

  if (user && currentRoom && !gameStarted) {
    return withProfile(
      <WaitingRoom
        room={currentRoom}
        onOpenProfile={(userId) => setProfileTarget({ userId })}
        userId={user.id}
        availablePlayers={availablePlayers}
        pendingInviteIds={pendingInviteIds}
        onInvitePlayer={invitePlayer}
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
        onSwapPlayers={swapRoomPlayers}
      />
    );
  }

  if (user && !currentRoom && !gameStarted) {
    return withProfile(
      <main className="lobby-dashboard">
        {roomInvite && (
          <div
            className="room-invite-notice"
            role="dialog"
            aria-label="Pozivnica u sobu"
            aria-live="polite"
          >
            <div className="room-invite-banner">
              <span className="room-invite-cards" aria-hidden="true">
                ♣
              </span>
              <span className="room-invite-label">POZIVNICA ZA PARTIJU</span>
              <button
                className="room-invite-close"
                type="button"
                aria-label="Zatvori pozivnicu"
                onClick={() => {
                  socketRef.current?.emit("respond_room_invite", {
                    roomCode: roomInvite.roomCode,
                    accepted: false,
                  });
                  setRoomInvite(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="room-invite-body">
              <strong>{roomInvite.hostName} te poziva u sobu</strong>
              <p>Želiš li se pridružiti i zaigrati Belot?</p>
              <div className="room-invite-actions">
                <button
                  className="room-invite-decline"
                  type="button"
                  onClick={() => {
                    socketRef.current?.emit("respond_room_invite", {
                      roomCode: roomInvite.roomCode,
                      accepted: false,
                    });
                    setRoomInvite(null);
                  }}
                >
                  Odbij
                </button>
                <button
                  className="room-invite-accept"
                  type="button"
                  onClick={() => {
                    const code = roomInvite.roomCode;
                    socketRef.current?.emit("respond_room_invite", {
                      roomCode: code,
                      accepted: true,
                    });
                    setRoomInvite(null);
                    joinRoom(code);
                  }}
                >
                  Prihvati <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <LobbyHeader
          username={user.username}
          socketConnected={socketConnected}
          loading={loading}
          onLogout={handleLogout}
          onOpenProfile={() => setProfileTarget({ userId: user.id })}
        />

        <div className="lobby-dashboard-content">
          <div className="lobby-welcome">
            <div>
              <h1>Pronađi svoju partiju</h1>
              <p>
                Pridruži se slobodnoj sobi ili kreiraj novu i zaigraj belot.
              </p>
            </div>

            <div
              className={`lobby-connection ${
                socketConnected ? "is-online" : "is-offline"
              }`}
            >
              <span className="lobby-connection-dot" />
              {socketConnected ? "Spojen na server" : "Povezivanje..."}
            </div>
          </div>

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

          <Lobby
            publicRooms={publicRooms}
            onOpenProfile={(userId) => setProfileTarget({ userId })}
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
        </div>
      </main>
    );
  }

  if (user && gameStarted) {
    if (!gameState) {
      return (
        <main className="game-only-page">
          <p>Partija se učitava...</p>
        </main>
      );
    }
    return withProfile(
      <main className="game-only-page">
        <GameTable
          gameNotice={gameNotice?.message}
          onCloseGameNotice={() => setGameNotice(null)}
          onOpenProfile={(username) => setProfileTarget({ username })}
          players={gameState.players.map((player) => ({
            id: player.socketId,
            username: player.username,
            seat: (player.playerNumber - 1) as 0 | 1 | 2 | 3,
            isDealer: player.isDealer,
            sameIpWarning: player.sameIpWarning,
          }))}
          hand={gameState.myHand}
          playedCards={gameState.currentTrick}
          trickCollectWinner={trickCollectWinner}
          currentPlayerId={
            gameState.players.find(
              (player) => player.playerNumber === gameState.currentPlayerNumber,
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
          roundHistory={gameState.roundHistory}
          matchWinnerTeam={gameState.matchWinnerTeam}
          finalScore={gameState.finalScore}
          team1DeclarationPoints={gameState.team1DeclaredPoints}
          team2DeclarationPoints={gameState.team2DeclaredPoints}
          team1Bela={gameState.team1Bela}
          team2Bela={gameState.team2Bela}
          activeDeclarations={gameState.activeDeclarations}
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
            gameState.activeDeclarations.length === 0 &&
            gameState.players.some(
              (player) =>
                player.socketId === socketRef.current?.id &&
                player.playerNumber === gameState.currentPlayerNumber,
            )
          }
          canChooseTrump={
            gameState.phase === "trump_call" &&
            gameState.activeDeclarations.length === 0 &&
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
      </main>
    );
  }

  return withProfile(
    <main className="page-shell">
      {roomInvite && (
        <div
          className="room-invite-notice"
          role="dialog"
          aria-label="Pozivnica u sobu"
          aria-live="polite"
        >
          <div className="room-invite-banner">
            <span className="room-invite-cards" aria-hidden="true">
              ♣
            </span>
            <span className="room-invite-label">POZIVNICA ZA PARTIJU</span>
            <button
              className="room-invite-close"
              type="button"
              aria-label="Zatvori pozivnicu"
              onClick={() => {
                socketRef.current?.emit("respond_room_invite", {
                  roomCode: roomInvite.roomCode,
                  accepted: false,
                });
                setRoomInvite(null);
              }}
            >
              ×
            </button>
          </div>
          <div className="room-invite-body">
            <strong>{roomInvite.hostName} te poziva u sobu</strong>
            <p>Želiš li se pridružiti i zaigrati Belot?</p>
            <div className="room-invite-actions">
              <button
                className="room-invite-decline"
                type="button"
                onClick={() => {
                  socketRef.current?.emit("respond_room_invite", {
                    roomCode: roomInvite.roomCode,
                    accepted: false,
                  });
                  setRoomInvite(null);
                }}
              >
                Odbij
              </button>
              <button
                className="room-invite-accept"
                type="button"
                onClick={() => {
                  const code = roomInvite.roomCode;
                  socketRef.current?.emit("respond_room_invite", {
                    roomCode: code,
                    accepted: true,
                  });
                  setRoomInvite(null);
                  joinRoom(code);
                }}
              >
                Prihvati <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
            Okupi četiri igrača, odaberi svoju sobu i pokaži tko najbolje
            poznaje Belot.
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

              {currentRoom ? (
                <WaitingRoom
                  room={currentRoom}
        onOpenProfile={(userId) => setProfileTarget({ userId })}
                  userId={user.id}
                  availablePlayers={availablePlayers}
                  pendingInviteIds={pendingInviteIds}
                  onInvitePlayer={invitePlayer}
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
                  onSwapPlayers={swapRoomPlayers}
                />
              ) : pathname.startsWith("/room/") ? (
                <div className="lobby-section">
                  <h3>
                    {loading ? "Soba se učitava..." : "Povezivanje sa sobom..."}
                  </h3>
                </div>
              ) : (
                <Lobby
                  publicRooms={publicRooms}
            onOpenProfile={(userId) => setProfileTarget({ userId })}
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
                      aria-label={
                        showPassword ? "Sakrij lozinku" : "Prikaži lozinku"
                      }
                      aria-pressed={showPassword}
                      title={
                        showPassword ? "Sakrij lozinku" : "Prikaži lozinku"
                      }
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
