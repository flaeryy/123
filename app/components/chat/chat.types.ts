
export type ChatMessage = {
  id: number;
  roomCode: string;
  userId: number | null;
  username: string;
  message: string;
  createdAt: string | Date;
};
