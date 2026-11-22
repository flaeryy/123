// Pravila zavrsetka meca. Ovdje nema Socket.IO logike ni rada s bazom.
export type MatchSettings = {
  gameType: "dosta" | "prolaz";
  targetScore: 501 | 701 | 1001;
  turnDuration: 15 | 30 | 45;
};

export type MatchTeam = 1 | 2;

// DOSTA: bodovi vec upisani u mec + bodovi osvojeni u ovom dijeljenju.
// Ako oba tima istovremeno dosegnu cilj (npr. zbog zvanja), prednost ima
// ekipa s vise bodova; kod izjednacenja nastavlja se igrati.
export function checkDostaWinner(
  settings: MatchSettings,
  team1: number,
  team2: number,
): MatchTeam | null {
  if (settings.gameType !== "dosta") return null;
  if (team1 < settings.targetScore && team2 < settings.targetScore) return null;
  if (team1 === team2) return null;
  return team1 > team2 ? 1 : 2;
}

// PROLAZ: odluka se donosi tek nakon obracuna cijelog dijeljenja.
// Pozivatelj koji padne ne dobiva bodove zvanja, vec vrijedi obracun pada.
export function checkProlazWinner(
  settings: MatchSettings,
  team1: number,
  team2: number,
): MatchTeam | null {
  if (settings.gameType !== "prolaz") return null;
  if (team1 < settings.targetScore && team2 < settings.targetScore) return null;
  if (team1 === team2) return null;
  return team1 > team2 ? 1 : 2;
}
