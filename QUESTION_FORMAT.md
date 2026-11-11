# Question format

The quiz copies the format of the **NCC Women's Health Care Nurse Practitioner (WHNP-BC) exam**, which PSI delivers at test centers and by remote proctoring. These rules come from NCC's own documents (links at the bottom), not from third-party prep sites.

## What NCC says about the exam

- 175 multiple-choice questions, 3 hours. 150 count; 25 are unscored pretest items.
- **One question format for every NCC exam:** a stem followed by **three options**, A, B and C. One is correct; the other two are distractors.
- **Options are alphabetized by their first word**, so the position of the correct answer carries no information.
- Questions appear one at a time. You can leave an item blank and return to it, flag items for review, go back, and change answers as often as you like within the time limit. Unanswered items count as wrong.
- Questions test both basic knowledge and application. Stems are short; many read as a statement to complete ("The most common indication for primary cesarean birth is…"), others as a brief scenario ("After two months on a low-dose combination pill, a patient reports… The nurse practitioner should…").
- Lab values appear in conventional units with SI units in parentheses. Drugs appear by generic and trade name where appropriate.
- No passing percentage is published; NCC scores by ability level (Rasch). Topic feedback is given as word descriptors (very weak → very strong), not percentages.

## How the app applies it

| NCC rule | In the app |
|---|---|
| Stem + 3 options, 1 correct | Every board-style item has exactly 3 options and one correct answer (`lib/questions.ts`, checked by the verification script). |
| Alphabetized by first word | `alphabetize()` sorts options by first word, ignoring leading symbols. |
| Flag, go back, change answers, no feedback until the end, timer | **Practice exam** (`/exam`, `components/ExamShell.tsx`). Time = n × (3 h ÷ 175). |
| Spread across the content outline | The practice exam draws questions round-robin across the selected topics, one per condition where possible (`selectBalanced`). |
| Immediate-feedback studying | The quiz modes on the home page use the same 3-option items but reveal the answer and the source row after each question. |

### Content constraint

Everything medical on screen is **verbatim text from the study document**, errors included. The stem templates ("A patient presents with …. The most likely diagnosis is") are fixed wording with no medical content. Clues are whole cells, single lines, or semicolon-separated fragments of a line. Condition names that appear inside a clue are masked as ▢▢▢.

What the app can't copy from NCC, because it would mean adding information the notes don't contain: SI units in parentheses, trade names, and clinical vignettes richer than the notes' own wording.

### Question types

| Mode | Stem direction | Options |
|---|---|---|
| Name the diagnosis | clue (presentation, work-up, treatment…) → condition | 3 conditions from the same topic |
| Management & work-up | condition → field fragment | the correct fragment + 2 same-field fragments from other conditions in the topic, chosen for similar length |
| Look-alike pairs | clue → condition | the two neighbouring conditions in the table + 1 more |
| Red flags & referrals | referral/emergency line → condition | 3 conditions |
| Picture questions | image → condition | 3 conditions with images, same topic where possible |
| Board-style (mixed) | all of the above | |

## Sources

- NCC, *2026 Candidate Guide: Women's Health Care Nurse Practitioner*, "About the exam" (p. 6) and "Sample questions" (p. 17): https://nccwebsite.org/content/documents/cms/whnp-candidate_guide.pdf
- NCC, *Guide to Testing Methods* (computer-based testing, item display and navigation): https://nccwebsite.org/content/documents/cms/ncc-testing-guide.pdf
- NCC, WHNP content outline: https://nccwebsite.org/content/documents/cms/whnp-content-outline.pdf
- NCC exam page (scheduling through PSI): https://nccwebsite.org/certification-exams/details/8
