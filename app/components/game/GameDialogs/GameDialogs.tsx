
import "./GameDialogs.css";
import { TrumpSelectionDialog } from "./dialogs/TrumpSelectionDialog";
import { DeclarationSelectionDialog } from "./dialogs/DeclarationSelectionDialog";
import { DeclarationResultDialog } from "./dialogs/DeclarationResultDialog";

import type { BelotSuit, BelotCard } from "../GameTable";
import type { ReactNode } from "react";

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

  activeDeclarations: {
    playerNumber: 1 | 2 | 3 | 4;
    cards: BelotCard[];
    points: number;
  }[];

  onSubmitDeclarations?: (cards: BelotCard[]) => void;

  getPlayerName: (playerNumber: 1 | 2 | 3 | 4) => string;
  renderCard: (card: BelotCard) => ReactNode;
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
  activeDeclarations,
  onSubmitDeclarations,
  getPlayerName,
  renderCard,
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

      {activeDeclarations.length > 0 && (
        <DeclarationResultDialog
          declarations={activeDeclarations}
          getPlayerName={getPlayerName}
          renderCard={renderCard}
        />
      )}
    </>
  );
}
