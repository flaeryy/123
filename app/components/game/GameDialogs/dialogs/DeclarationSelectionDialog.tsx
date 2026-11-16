
import type { BelotCard } from "../../GameTable";
import "./DeclarationSelectionDialog.css";

interface DeclarationSelectionDialogProps {
  completedPlayers: number;
  totalPlayers: number;
  canDeclare: boolean;
  declarationTurnPlayerName: string;
  selectedCards: BelotCard[];
  onSubmitDeclarations?: (cards: BelotCard[]) => void;
}

export function DeclarationSelectionDialog({
  completedPlayers,
  totalPlayers,
  canDeclare,
  declarationTurnPlayerName,
  selectedCards,
  onSubmitDeclarations,
}: DeclarationSelectionDialogProps) {
  return (
    <section className="trump-controls in-table-trump-controls declaration-controls">
      <span className="declaration-progress">
        ZVANJA · {completedPlayers}/{totalPlayers}
      </span>

      <strong>
        {canDeclare
          ? "Odaberi karte i pozovi zvanje"
          : `Čeka se ${declarationTurnPlayerName}`}
      </strong>

      {canDeclare && (
        <div className="declaration-actions">
          <button
            type="button"
            className="primary-button"
            disabled={selectedCards.length === 0}
           onClick={() => {
  console.log("KLIK NA POZOVI", selectedCards);
  onSubmitDeclarations?.(selectedCards);
}}
          >
            Pozovi
          </button>

          <button
            type="button"
            className="pass-trump-button"
            onClick={() => onSubmitDeclarations?.([])}
          >
            Nemam zvanja
          </button>
        </div>
      )}
    </section>
  );
}
