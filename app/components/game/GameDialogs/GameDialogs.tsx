
import "./GameDialogs.css";
import { TrumpSelectionDialog } from "./dialogs/TrumpSelectionDialog";
import { DeclarationSelectionDialog } from "./dialogs/DeclarationSelectionDialog";

import type { BelotSuit, BelotCard } from "../GameTable";

interface GameDialogsProps {
  phase: string;
  canChooseTrump: boolean;
  canPassTrump: boolean;
  trumpTurnPlayerNumber: number | undefined;

  suitOrder: BelotSuit[];
  suits: Record<
    BelotSuit,
    {
      name: string;
      icon: string;
      red: boolean;
    }
  >;

  onChooseTrump?: (suit: BelotSuit) => void;
  onPassTrump?: () => void;

  completedDeclarationPlayers: number;
  canDeclare: boolean;
  declarationTurnPlayerName: string;
  selectedDeclarationCards: BelotCard[];


  onSubmitDeclarations?: (cards: BelotCard[]) => void;

}

export function GameDialogs({
  phase,
  canChooseTrump,
  canPassTrump,
  trumpTurnPlayerNumber,
  suitOrder,
  suits,
  onChooseTrump,
  onPassTrump,
  completedDeclarationPlayers,
  canDeclare,
  declarationTurnPlayerName,
  selectedDeclarationCards,
  onSubmitDeclarations,
}: GameDialogsProps) {
  return (
    <>
      {phase === "trump_call" && canChooseTrump && (
        <TrumpSelectionDialog
          canChooseTrump={canChooseTrump}
          canPassTrump={canPassTrump}
          trumpTurnPlayerNumber={trumpTurnPlayerNumber}
          suitOrder={suitOrder}
          suits={suits}
          onChooseTrump={onChooseTrump}
          onPassTrump={onPassTrump}
        />
      )}

      {phase === "declarations" && canDeclare && (
        <DeclarationSelectionDialog
          completedPlayers={completedDeclarationPlayers}
          totalPlayers={4}
          canDeclare={canDeclare}
          declarationTurnPlayerName={declarationTurnPlayerName}
          selectedCards={selectedDeclarationCards}
          onSubmitDeclarations={onSubmitDeclarations}
        />
      )}

    </>
  );
}
