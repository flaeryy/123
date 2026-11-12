import { io } from "socket.io-client";

const socket = io("http://127.0.0.1:3001");

socket.on("connect", () => {
  console.log("Uspješno spojen igrač:", socket.id);

  setTimeout(() => {
    socket.disconnect();
  }, 2000);
});

socket.on("connect_error", (error) => {
  console.error("Greška pri spajanju:", error.message);
});