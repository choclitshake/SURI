# Challenge problem banks

Harder "challenge" items for the **diagnostic probe bank** and the **quiz / practice problem bank** (ClickUp CU-14ypx624mw5).
A challenge item needs two or three linked reasoning moves (work backwards, two conditions at once, compare options,
multi-stage change, reverse the skill, spot the error, pattern to rule). It is not just bigger numbers.

This folder holds the offline pipeline that generates, verifies, reviews and exports those items. The runtime behaviour
(how they are mixed into a session) lives in the backend and is described at the end.

## Scope

Only the 14 nodes on a learning path get challenge items. `IN_SCOPE` is computed in `challenge_specs.py` from
`ENTRY_NODES` and the `prerequisite` chain in `backend/graph.py`, so it follows the graph:

```
QE <- FP <- SP <- LE <- OI <- FD        SLE <- L2V <- L1V <- AE <- RPP <- FD
RER <- LE <- OI <- FD                   PE <- PO
```

PD (Polynomial Division) is on no path, so it is excluded and its existing items are never touched. The generator
refuses any `--nodes` value outside `IN_SCOPE`.

Existing items are never changed or removed. New diagnostic probes are **appended after** the existing 16 per node
(`sessions.current_probe_index` stores an index into that list), and new quiz problems are new rows.

## Pipeline

All commands run from the repo root with a Python that has `pypdf` and `google-genai` installed. They need
`GEMINI_API_KEY` in `.env` and `node` on the PATH (the verifier uses `frontend/node_modules`).

```
python knowledge_base/challenge/generate_challenge_bank.py diagnostic --nodes L1V,SLE   # 12 candidates per node
python knowledge_base/challenge/generate_challenge_bank.py quiz       --nodes L1V,SLE   # 7 candidates + extras per node
python knowledge_base/challenge/generate_challenge_bank.py validate   --nodes L1V,SLE   # checks, blind solve, variety rules
python knowledge_base/challenge/generate_challenge_bank.py quiz       --nodes L1V --topup   # fill a shortfall
python knowledge_base/challenge/generate_challenge_bank.py review     --nodes L1V,SLE   # writes work/review.md
python knowledge_base/challenge/generate_challenge_bank.py export     --nodes L1V,SLE
```

Omit `--nodes` for every in-scope node. `--dry-run` prints the first prompt without calling Gemini.

Every step is resumable. Raw model responses are cached in `work/raw/` before they are parsed, so a crash or a re-run
never pays for the same call twice. `work/` is gitignored.

| File | Role |
| :--- | :--- |
| `challenge_specs.py` | Per-node challenge kinds, patterns, contexts, grade, the node-to-PDF map (`SLM_PDFS`), and `IN_SCOPE`. |
| `generate_challenge_bank.py` | Generation prompts, validation, selection, review file, export. |
| `katex_format.py` | Converts generated text into the stored KaTeX forms (next section). |
| `gemini_pacing.py` | Shared rate limiter, daily budget, retries and the on-disk response cache. |
| `review_decisions.json` | Committed list of rejected item ids (`{"reject": {"<item id>": "reason"}}`). |
| `challenge_practice_problems.json` | Exported quiz rows (committed). |
| `../../scripts/seed_challenge_problems.sql` | Idempotent seed for the quiz rows (committed). |

### Grounding

Every prompt includes excerpts of the node's DepEd Self-Learning Module and the rule "use only methods shown in the
excerpt"; each item must name the concept it uses (`slm_concept`). Challenge items therefore stay inside the competency
the node teaches.

The file names in `knowledge_base/slm_pdfs/` do **not** reliably match the module printed inside each PDF (for example
`grade7_linear_equations_one_var.pdf` is the Special Products module). `SLM_PDFS` in `challenge_specs.py` maps nodes by
the module title inside the PDF. Check a PDF's first page before trusting a file name. Five modules (systems of linear
equations, quadratic formula, nature of roots, polynomial functions) were added to `slm_pdfs/` from DepEd Tambayan to
fill gaps. One gap remains: there is no Grade 10 module on solving polynomial equations by name.

### What validation checks

An item is dropped on any failure:

1. **Answer check.** A machine-checkable `check` (`eval`, `solve`, `system`, `expr`) is verified with mathjs and mathsteps
   through `playground/verify.js`. Exactly one diagnostic option may satisfy it. `manual` is allowed only for
   multiple-choice-only kinds such as "spot the error", and those rely on the blind solve.
2. **Distractors.** Exactly three per step or question, distinct, non-empty, and different from the correct answer.
3. **Steps (quiz).** 4 to 8 steps, at least one `variable_identification`, last step equals the answer, each blank has a
   single `___`, every `correct_value` is short and typeable (never a phrase such as "the number").
4. **Blind solve.** A separate Gemini call solves each item without seeing the answer and must agree.
5. **Rules.** English only, no near-duplicates (of existing items or each other), the answer is not in the prompt,
   and `slm_concept` and at least two stated relationships are present.
6. **Variety.** Per node: no kind more than twice (diagnostic) or once (quiz), at least 3 reasoning patterns, any one
   context at most twice, and at most one age problem, only in L1V, SLE and QE.

## KaTeX storage format

This is the part other developers most often need. The frontend renders stored text through `react-markdown` with
`remark-math` and `rehype-katex` (`quiz/page.tsx`, `practice/page.tsx`, `diagnostic/page.tsx`), and standard practice
compares typed answers through `normalize_val` in `backend/routes/practice_routes.py`. Stored challenge data follows
these conventions, and `export` refuses to write anything that violates them:

| Field | Stored as | Example |
| :--- | :--- | :--- |
| `word_problem_text`, step `instruction`, hint, diagnostic `question_text` | Prose, with every piece of math inside `$...$` | `Let $w$ be the width. Write $2(w + 5) = 50$.` |
| `blank_expression` | One `$...$` span with **exactly one `?`** as the blank (both pages replace the first `?`, not `___`). Words go in `\text{...}`. | `$\text{Length} = ?$`, `$2w = ?$` |
| `correct_value`, distractors | **Bare** LaTeX, no `$`, implicit multiplication | `2w + 5`, `\frac{3}{4}`, `w^{2}`, `x = 14` |
| Diagnostic options | `$...$` | `$x = 5$` |
| `problem_expr` | mathjs ASCII, as in the existing rows | `2*(w + (w + 5)) = 50` |

Why these choices:

- The quiz wraps bare choices and blanks in `$...$` itself, but only when the text has no multi-letter words or commas.
  Explicit `$...$` for prose and blanks avoids that guard, and `\text{}` keeps words readable inside a formula.
- Bare values keep `normalize_val` matching simple: it strips `$`, turns `\frac{a}{b}` into `a/b`, removes `*` between a
  coefficient and a variable, and rewrites `^{n}` to `^n`. A value stored as `2w + 5` and a MathLive answer of `2w+5`
  normalise to the same string.
- `?` must appear once. `fixUnbalancedMath` in the practice page splits the blank on it, so a `$...$` span that
  contains the blank is safe, but a second `?` would break the split.

During generation the model writes machine-checkable fields (`blank_expression`, `correct_value`, `answer`, `check`) in
mathjs ASCII and prose with `$...$`. `katex_format.py` then converts: `ascii_to_katex` (ASCII to LaTeX), `to_blank`,
`to_value`, and `katexify_prose` (wraps stray math in prose and converts existing `$...$` spans). At export,
`check_final` re-parses every stored value and rejects an item whose meaning changed, or that has raw `*`, `^` or `_`
outside `$...$`. If you change the converter, run `backend/tests/test_challenge_katex.py`.

## Gemini usage and rate limits

All calls (generation, extras, blind solve) go through one limiter in `gemini_pacing.py`. Defaults stay near 80% of the
free-tier limits (15 RPM, 250k TPM):

| Setting | Default | Meaning |
| :--- | :--- | :--- |
| `CHALLENGE_MAX_RPM` | 12 | Requests in any 60 s window (and at least 5 s between call starts). |
| `CHALLENGE_MAX_TPM` | 200000 | Tokens in any 60 s window (estimated before the call, corrected after). |
| `CHALLENGE_DAILY_CALL_BUDGET` | 400 | Calls per day, counted in `work/budget.json`. The run stops cleanly when reached. |

Retries use exponential backoff (15, 30, 60, 120 s) and honour a delay in the error. A daily-quota error stops the run
with a message; re-running the same command resumes from the cache. Empty responses are retried and never cached.
`PLAYGROUND_GEMINI_MODEL` and `PLAYGROUND_BLIND_MODEL` (defined in `playground/pg_common.py`) change the models.

A full run for 14 nodes is roughly 250 calls, about 30 to 40 minutes.

## Review, export and database

1. Read `work/review.md`. It shows each surviving item in its stored form, with its answer, distractors, steps, SLM
   concept, and whether it was verified by `check+blind` or `blind only`.
2. Reject any item by adding its id to `review_decisions.json`, then re-run `review` and `export`.
3. `export` appends approved diagnostic items to `backend/data/diagnostic_probes.json` (asserting the existing items are
   unchanged), writes `challenge_practice_problems.json`, and writes `scripts/seed_challenge_problems.sql`.
4. Database changes are separate and shared. The `difficulty` column on `practice_problems` is added by
   `scripts/schema_supabase.sql` for new databases and by `knowledge_base/migrate_quiz_tables.py` for existing ones.
   The seed SQL starts with an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and inserts with
   `ON CONFLICT DO NOTHING` and deterministic ids (`uuid5` of node plus `problem_expr`), so re-running is safe.
   Run the migration and the seed only after agreeing it with the backend developer, because other people use the
   same database.

## Runtime behaviour

- **Diagnostic** (`backend/routes/diagnostic_routes.py`): `_probe_order` returns a deterministic, session-seeded order whose
  first 4 positions are 3 standard + `CHALLENGE_PER_NODE` (1) challenge probes. The rest follow, so the wrap-around still
  works. Probes without `"difficulty"` count as standard. With no challenge probes it falls back to a plain shuffle.
- **Quiz and standard practice** (`quiz_routes.py`, `practice_routes.py`): `sample_mixed` in `backend/problem_sampling.py`
  picks 3 standard + 2 challenge, topping up from the other pool when one runs short.
- **Timers**: `step_timer_ms(step_type, difficulty)` in `quiz_routes.py` is the single source for the countdown sent to
  the frontend (`timer_ms`) and the point calculation in `submit_step`. Keep them on the same helper or scoring drifts.

## Tests

```
python -m pytest backend/tests/test_challenge_mix.py backend/tests/test_challenge_generator.py backend/tests/test_challenge_katex.py
```

`test_challenge_generator.py` and `test_challenge_katex.py` start the node verifier, so they need `node` and
`frontend/node_modules`. None of the tests call Gemini or the database.
