"use client";

/**
 * Board-style quiz modes (NCC format: stem + 3 alphabetized options, one correct).
 * All modes share one component; they differ only in which generator builds the items.
 */
import { useCallback, useState } from "react";
import { BoardQuestion } from "@/components/BoardQuestion";
import {
  buildDiagnosis,
  buildImage,
  buildLookalike,
  buildManagement,
  buildMixed,
  buildRedFlags,
  type BoardItem,
} from "@/lib/questions";
import type { QuizItemProps, QuizMode } from "@/lib/types";

function BoardMode({ item, onAnswer, result }: QuizItemProps<BoardItem>) {
  const [selected, setSelected] = useState<number | null>(null);
  const select = useCallback(
    (i: number) => {
      if (result !== null) return;
      setSelected(i);
      onAnswer(item.data.options[i].correct);
    },
    [item, onAnswer, result],
  );
  return <BoardQuestion item={item.data} selected={selected} onSelect={select} revealed={result !== null} />;
}

function mode(
  id: string,
  name: string,
  description: string,
  buildItems: QuizMode<BoardItem>["buildItems"],
): QuizMode<BoardItem> {
  return { id, name, description, buildItems, Component: BoardMode };
}

export const boardMixedMode = mode(
  "board",
  "Board-style questions",
  "All question types combined. Three options per question.",
  buildMixed,
);

export const boardDiagnosisMode = mode(
  "board-dx",
  "Name the diagnosis",
  "Given a finding, work-up, or treatment from the tables, choose the condition.",
  buildDiagnosis,
);

export const boardManagementMode = mode(
  "board-mgmt",
  "Management & work-up",
  "Given a condition, choose its treatment, diagnostics, risk factors, education, or other listed field.",
  buildManagement,
);

export const boardImageMode = mode(
  "board-img",
  "Picture questions",
  "Choose the condition shown in an image from the tables (46 images).",
  buildImage,
);

export const boardRedFlagMode = mode(
  "board-red",
  "Red flags & referrals",
  "Built from table lines that mention referral, emergency, ED, or hospitalization.",
  buildRedFlags,
);

export const boardLookalikeMode = mode(
  "board-pairs",
  "Look-alike pairs",
  "Choose which of two neighbouring conditions in a table a finding belongs to.",
  buildLookalike,
);
