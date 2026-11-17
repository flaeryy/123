import {
  useCallback,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Socket } from "socket.io-client";

export type RoomChatMessage = {
  id: number;
  roomCode: string;
  userId: number | null;
  username: string;
  message: string;
  createdAt: string | Date;
};

export function useRoomChat(
  socketRef: RefObject<Socket | null>,
  setError: Dispatch<SetStateAction<string>>,
  currentUserId: number | null,
) {
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  // Registracija događaja za primanje poruka iz sobe.
  const registerChatListeners = useCallback(
    (socket: Socket) => {
      function handleChatHistory(messages: RoomChatMessage[]) {
        setChatMessages([...messages].reverse());
      }

      function handleChatMessage(message: RoomChatMessage) {
        setChatMessages((previous) => [...previous, message]);

        // Zvuk čuje samo korisnik koji je primio poruku.
        if (message.userId !== currentUserId) {
          const audio = new Audio("/sound/chat_sound.mp3");

          audio.volume = 0.3;

          void audio.play().catch(() => {});
        }
      }
      socket.on("room_chat_history", handleChatHistory);
      socket.on("room_chat_message", handleChatMessage);

      // Uklanjanje listenera kada se socket zatvara.
      return () => {
        socket.off("room_chat_history", handleChatHistory);
        socket.off("room_chat_message", handleChatMessage);
      };
    },
    [currentUserId],
  );

  // Slanje poruke na server.
  const sendChatMessage = useCallback(() => {
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
  }, [socketRef, chatInput, setError]);

  // Čišćenje poruka prilikom napuštanja ili zatvaranja sobe.
  const clearChat = useCallback(() => {
    setChatMessages([]);
    setChatInput("");
  }, []);

  return {
    chatMessages,
    chatInput,
    setChatInput,
    sendChatMessage,
    registerChatListeners,
    clearChat,
  };
}
