
import "./TrumpSelectionDialog.css";
import type { BelotSuit } from "../../GameTable";

interface TrumpSelectionDialogProps {
    canChooseTrump: boolean;
    //Da se zna da je djelitelj
    canPassTrump: boolean;
    trumpTurnPlayerNumber: number | undefined;
    suitOrder: BelotSuit[];
    suits: Record<BelotSuit, {
        name: string;
        icon: string;
        red: boolean;
    }>;
    onChooseTrump?: (suit: BelotSuit) => void;
    onPassTrump?: () => void;
}

export function TrumpSelectionDialog({
    canChooseTrump,
    canPassTrump,
    trumpTurnPlayerNumber,
    suitOrder,
    suits,
    onChooseTrump,
    onPassTrump,
}: TrumpSelectionDialogProps) {
    return (
        <section className="trump-controls in-table-trump-controls">
<div className="trump-prompt">
  <strong>
    {canChooseTrump && !canPassTrump
      ? "Zadnji ste na redu! Molimo, odaberite adut."
      : canChooseTrump
        ? "Na redu ste za zvanje aduta"
        : `Čeka se odabir igrača ${trumpTurnPlayerNumber ?? ""}`}
  </strong>

  {canPassTrump && (
    <button
      type="button"
      className="pass-trump-button"
      onClick={onPassTrump}
    >
      dalje
    </button>
  )}
</div>
            <div className="trump-buttons">
                {suitOrder.map((suit) => (
                    <button
                        type="button"
                        key={suit}
                        disabled={!canChooseTrump}
                        onClick={() => onChooseTrump?.(suit)}
                        className={`suit-button ${suits[suit].red ? "red-suit" : "black-suit"
                            }`}
                        aria-label={suits[suit].name}
                    >
                        <img src={suits[suit].icon} alt={suits[suit].name} />
                    </button>
                ))}
            </div>
        </section>
    );
}
