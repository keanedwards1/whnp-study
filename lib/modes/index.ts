import type { QuizMode } from "@/lib/types";
import {
  boardDiagnosisMode,
  boardImageMode,
  boardLookalikeMode,
  boardManagementMode,
  boardMixedMode,
  boardRedFlagMode,
} from "./board";
import { flashcardMode } from "./flashcard";

/**
 * Mode registry. The setup screen and quiz shell pick modes up from here.
 * Order = order shown on the setup screen.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each mode has its own payload type
export const modes: QuizMode<any>[] = [
  boardMixedMode,
  boardManagementMode,
  boardDiagnosisMode,
  boardLookalikeMode,
  boardRedFlagMode,
  boardImageMode,
  flashcardMode,
];

export function getMode(id: string | null | undefined) {
  return modes.find((m) => m.id === id);
}
