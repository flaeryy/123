import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type SocketUser = {
  id: number;
  username: string;
  email: string;
};

export function useSocket(user: SocketUser | null, apiUrl: string) {
  const socketRef = useRef<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      socketRef.current = null;
      setSocketConnected(false);
      return;
    }

    // Dohvat autentifikacijskog tokena iz sessionStoragea.
    const token = sessionStorage.getItem("belot_session");

    if (!token) {
      socketRef.current = null;
      setSocketConnected(false);
      return;
    }

    // Uspostavljanje Socket.IO veze.
    const socket = io(apiUrl, {
      auth: { token },
      reconnection: true,
      autoConnect: false,
    });

    socketRef.current = socket;

    function handleConnect() {
      setSocketConnected(true);
    }

    function handleDisconnect() {
      setSocketConnected(false);
    }

    function handleConnectError() {
      setSocketConnected(false);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    // Prekid veze i uklanjanje listenera.
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      setSocketConnected(false);
    };
  }, [user, apiUrl]);

  return {
    socketRef,
    socketConnected,
  };
}
