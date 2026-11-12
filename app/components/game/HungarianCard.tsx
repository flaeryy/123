
import Image from "next/image";
import type { Card } from "../../../server/src/game/cards";

type HungarianCardProps = {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
};

const suitFolders: Record<Card["suit"], string> = {
  hearts: "hearts",
  diamonds: "bell",
  clubs: "acorn",
  spades: "leaf",
};

const rankFiles: Record<Card["rank"], string> = {
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "10": "ten",
  J: "unter",
  Q: "ober",
  K: "king",
  A: "ace",
};

export default function HungarianCard({
  card,
  onClick,
  selected = false,
  disabled = false,
}: HungarianCardProps) {
  const imagePath = `/cards/${suitFolders[card.suit]}/${suitFolders[card.suit] === "hearts" ? "heart" : suitFolders[card.suit]}-${rankFiles[card.rank]}.png`;

  return (
    <button
      type="button"
      className={`hungarian-card ${selected ? "selected" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${card.rank} ${card.suit}`}
    >
      <Image
        src={imagePath}
        alt={`${card.rank} ${card.suit}`}
        width={181}
        height={293}
        draggable={false}
        priority
      />
    </button>
  );
}
