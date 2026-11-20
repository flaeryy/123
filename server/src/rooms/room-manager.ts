import { randomInt } from "node:crypto";

export type Player = {
  id: string;
  userId: number;
  username: string;
  isHost: boolean;
  rating: number;
};

export type Room = {
  code: string;
  players: Player[];
  maxPlayers: 4;
  status: "waiting" | "playing";
  createdAt: Date;
  isPublic: boolean;
  minRating: number;
};

const ROOM_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

class RoomManager {
  private rooms = new Map<string, Room>();
  private playerRooms = new Map<string, string>();

  private generateRoomCode(): string {
    let code: string;

    do {
      code = Array.from(
        { length: 6 },
        () => ROOM_CHARACTERS[randomInt(ROOM_CHARACTERS.length)],
      ).join("");
    } while (this.rooms.has(code));

    return code;
  }

  // Provjerava nalazi li se korisnički račun već u sobi
  private isUserInRoom(userId: number): boolean {
    return Array.from(this.rooms.values()).some((room) =>
      room.players.some((player) => player.userId === userId),
    );
  }

  // Stvaranje nove sobe
  createRoom(
    socketId: string,
    userId: number,
    username: string,
    isPublic = true,
    minRating = 0,
    rating = 0,
  ): Room {
    if (this.playerRooms.has(socketId)) {
      throw new Error("Već si u sobi.");
    }

    if (this.isUserInRoom(userId)) {
      throw new Error("Već sudjeluješ u jednoj partiji.");
    }

    const cleanUsername = username.trim();

    if (!cleanUsername || cleanUsername.length > 30) {
      throw new Error("Korisničko ime mora imati između 1 i 30 znakova.");
    }

    if (!Number.isInteger(minRating) || minRating < 0 || minRating > 10) {
      throw new Error("Minimalni rejting mora biti između 0 i 10.");
    }

    if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
      throw new Error("Rejting mora biti između 0 i 10.");
    }

    const code = this.generateRoomCode();

    const room: Room = {
      code,
      players: [
        {
          id: socketId,
          userId,
          username: cleanUsername,
          isHost: true,
          rating,
        },
      ],
      maxPlayers: 4,
      status: "waiting",
      createdAt: new Date(),
      isPublic,
      minRating,
    };

    this.rooms.set(code, room);
    this.playerRooms.set(socketId, code);

    return room;
  }

  // Pridruživanje postojećoj sobi
  joinRoom(
    socketId: string,
    userId: number,
    username: string,
    roomCode: string,
    rating: number,
  ): Room {
    if (this.playerRooms.has(socketId)) {
      throw new Error("Već si u jednoj sobi.");
    }

    if (this.isUserInRoom(userId)) {
      throw new Error("Već sudjeluješ u jednoj partiji.");
    }

    const cleanUsername = username.trim();

    if (!cleanUsername || cleanUsername.length > 30) {
      throw new Error("Korisničko ime mora imati između 1 i 30 znakova.");
    }

    if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
      throw new Error("Rejting mora biti između 0 i 10.");
    }

    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      throw new Error("Soba ne postoji.");
    }

    if (room.status !== "waiting") {
      throw new Error("Partija je već započela.");
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error("Soba je puna.");
    }

    if (rating < room.minRating) {
      throw new Error("Tvoj rejting je prenizak za ulazak u ovu sobu.");
    }

    const player: Player = {
      id: socketId,
      userId,
      username: cleanUsername,
      isHost: false,
      rating,
    };

    room.players.push(player);
    this.playerRooms.set(socketId, code);

    return room;
  }

  // Uklanjanje igrača iz sobe
  leaveRoom(socketId: string): Room | null {
    const roomCode = this.playerRooms.get(socketId);

    if (!roomCode) {
      return null;
    }

    const room = this.rooms.get(roomCode);

    this.playerRooms.delete(socketId);

    if (!room) {
      return null;
    }

    room.players = room.players.filter((player) => player.id !== socketId);

    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      return null;
    }

    if (!room.players.some((player) => player.isHost)) {
      room.players[0].isHost = true;
    }

    return room;
  }

  // Dohvaćanje sobe prema kodu
  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.trim().toUpperCase());
  }

  getUserRoom(userId: number): Room | undefined {
    return Array.from(this.rooms.values()).find((room) =>
      room.players.some((player) => player.userId === userId),
    );
  }

  returnToLobby(roomCode: string): Room | undefined {
    const room = this.getRoom(roomCode);

    if (room) {
      room.status = "waiting";
    }

    return room;
  }

  // Dohvaćanje sobe u kojoj se nalazi određena veza
  getPlayerRoom(socketId: string): Room | undefined {
    const roomCode = this.playerRooms.get(socketId);

    if (!roomCode) {
      return undefined;
    }

    return this.rooms.get(roomCode);
  }

  swapPlayers(
    hostSocketId: string,
    firstSeat: number,
    secondSeat: number,
  ): Room {
    const room = this.getPlayerRoom(hostSocketId);

    if (!room || room.status !== "waiting") {
      throw new Error("Soba nije dostupna za promjenu mjesta.");
    }

    const host = room.players.find((player) => player.id === hostSocketId);

    if (!host?.isHost) {
      throw new Error("Samo domaćin može mijenjati mjesta.");
    }

    if (
      !Number.isInteger(firstSeat) ||
      !Number.isInteger(secondSeat) ||
      firstSeat < 0 ||
      secondSeat < 0 ||
      firstSeat >= room.players.length ||
      secondSeat >= room.players.length ||
      firstSeat === secondSeat
    ) {
      throw new Error("Neispravna mjesta igrača.");
    }

    const firstPlayer = room.players[firstSeat];
    room.players[firstSeat] = room.players[secondSeat];
    room.players[secondSeat] = firstPlayer;

    return room;
  }

  // Pokretanje partije
  startGame(socketId: string): Room {
    const room = this.getPlayerRoom(socketId);

    if (!room) {
      throw new Error("Nisi u sobi.");
    }

    const player = room.players.find((item) => item.id === socketId);

    if (!player?.isHost) {
      throw new Error("Samo domaćin može pokrenuti partiju.");
    }

    if (room.status !== "waiting") {
      throw new Error("Partija je već pokrenuta.");
    }

    if (room.players.length !== 4) {
      throw new Error("Za pokretanje partije potrebna su četiri igrača.");
    }

    room.status = "playing";

    return room;
  }

  // Dohvaćanje javnih soba koje još primaju igrače
  listPublicRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(
      (room) =>
        room.isPublic &&
        room.status === "waiting" &&
        room.players.length < room.maxPlayers,
    );
  }
}

export const roomManager = new RoomManager();
