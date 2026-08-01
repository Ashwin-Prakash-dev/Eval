# Sample data for testing

**`submissions.csv`** — 15 gibberish hackathon submissions for the bulk import
flow. Log in as admin → **Submissions** → **Bulk import** → pick this file.
All rows have real (safe, well-known) YouTube links so the pitch video embed
actually renders, except two rows (`InvisiBudget`, `Ferret-as-a-Service`) which
use `video_type=upload` with no URL, so you can test uploading a local video
file from the submission detail page instead.

`problem_statement_code` is left blank on every row so the import always
succeeds with zero setup. If you want to see problem-statement grouping too,
first add a couple via **Submissions → Problem statements**, e.g.:

| code | title |
|---|---|
| PS1 | Sustainable Tech |
| PS2 | Fintech Innovation |
| PS3 | Health & Wellness |

then edit a few CSV rows to fill in `PS1`/`PS2`/`PS3` before re-importing (or
just assign problem statements to individual submissions afterward via the
Edit dialog).

**`sample-deck-*.pdf`** / **`sample-slides-*.pptx`** — dummy files (real,
openable PDF/PPTX, gibberish content) for testing the per-submission file
upload widgets on the submission detail page. The PDF renders inline; the
PPTX shows the "download to view" card, since browsers can't render `.pptx`
natively.

## Suggested test flow

1. Bulk import `submissions.csv`.
2. Open a submission, upload one of the sample PDFs/PPTs, confirm the
   previews render.
3. Register 2–3 judge accounts (or create them from **Judges**).
4. **Assignments → Generate assignments** (try e.g. 2 judges per submission).
5. Log in as a judge, evaluate a couple of submissions, mark one complete,
   and confirm it appears on the **Leaderboard** and **Analytics** pages.
