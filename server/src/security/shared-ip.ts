// IP adrese ostaju samo na serveru. Klijent dobiva iskljucivo boolean oznaku.
export function sharedIpSocketIds(
  socketIds: readonly string[],
  ipBySocketId: ReadonlyMap<string, string>,
): Set<string> {
  const grouped = new Map<string, string[]>();

  for (const socketId of socketIds) {
    const ip = ipBySocketId.get(socketId);
    if (!ip) continue;
    const existing = grouped.get(ip) ?? [];
    existing.push(socketId);
    grouped.set(ip, existing);
  }

  const flagged = new Set<string>();
  for (const sockets of grouped.values()) {
    if (sockets.length < 2) continue;
    for (const socketId of sockets) flagged.add(socketId);
  }
  return flagged;
}
