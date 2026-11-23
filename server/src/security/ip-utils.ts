import { isIP } from "node:net";

// Koristimo adresu Socket.IO veze. Ne vjerujemo klijentskom X-Forwarded-For headeru.
export function normalizeSocketIp(address: string | undefined): string | null {
  if (!address) return null;
  const value = address.trim().toLowerCase();
  const normalized = value.startsWith("::ffff:") ? value.slice(7) : value;
  if (normalized === "::1") return "127.0.0.1";
  return isIP(normalized) ? normalized : null;
}
