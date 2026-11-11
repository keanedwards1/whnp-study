# WHNP Board Prep

Private self-quiz app built from the Google Doc **"Disorder Tables"**. The content is copied verbatim from the doc, including any errors in it.

- `/`: set up a quiz (type, topics, number of questions, all / missed / due)
- `/quiz`: a quiz with feedback after each question
- `/exam`: a timed practice exam in the real test's format, answers at the end
- `/browse`: the source tables, with images, for studying

There's no backend. Content is static (`data/disorders.json`), and progress is saved in the browser's localStorage. Use "Copy progress code" on the home page to move progress between devices. The site is noindexed (meta tag, `robots.txt`, and an `X-Robots-Tag` header), but anyone with the link can open it.

## Develop

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Option A: push this folder to a GitHub repo, then on vercel.com use **Add New → Project → Import** and keep the defaults.
Option B: from this folder run `npx vercel` (first time: log in and accept the defaults), then `npx vercel --prod`.

## Re-extract the content (only if the doc changes)

1. Save a fresh Google Docs API `documents.get` response (e.g. Claude's Google Docs `read_doc` tool) to `scripts/raw/doc.json`. Do this right before step 2: the image URLs in it expire within minutes.
2. Delete `public/images/*` if images changed, then run `python3 -I scripts/extract.py`.

## Question format

Questions follow the NCC WHNP-BC exam format (stem + three alphabetized options, one correct). See `QUESTION_FORMAT.md` for the rules, their sources, and how each quiz mode applies them. Generators live in `lib/questions.ts`; modes in `lib/modes/` are registered in `lib/modes/index.ts`.
