
import type { ReactNode } from "react";
import type { BelotCard } from "../../GameTable";
import "./DeclarationResultDialog.css";

interface ActiveDeclaration {
  playerNumber: 1 | 2 | 3 | 4;
  cards: BelotCard[];
  points: number;
}

interface DeclarationResultDialogProps {
  declarations: ActiveDeclaration[];
  getPlayerName: (playerNumber: 1 | 2 | 3 | 4) => string;
  renderCard: (card: BelotCard) => ReactNode;
}

export function DeclarationResultDialog({
  declarations,
  getPlayerName,
  renderCard,
}: DeclarationResultDialogProps) {
  if (declarations.length === 0) return null;

  const totalPoints = declarations.reduce(
    (total, declaration) => total + declaration.points,
    0
  );

  return (
    <div className="declaration-reveal" aria-live="polite">
      <strong>ZVANJA POBJEDNIČKE EKIPE</strong>

      {declarations.map((declaration) => (
        <div
          key={declaration.playerNumber}
          className="declaration-result-player"
        >
          <span className="declaration-reveal-player">
            {getPlayerName(declaration.playerNumber)} zove
          </span>

          <div className="declaration-reveal-cards">
            {declaration.cards.map((card) => renderCard(card))}
          </div>

          <strong>{declaration.points} bodova</strong>
        </div>
      ))}

      <strong>Ukupno bodova: {totalPoints}</strong>
    </div>
  );
}
