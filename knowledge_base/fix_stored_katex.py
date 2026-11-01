"""
fix_stored_katex.py -- repair stored math text that renders wrongly on the frontend.

Only deterministic, verified-by-rendering fixes are applied (the real react-markdown + remark-math + rehype-katex
stack was used to confirm each defect class; see the rules below). Anything that cannot be fixed mechanically is
reported and left alone.

Rules
  R1  blank_expression: a bare math string with a "___" blank (the quiz page auto-wraps it as math, where "_" is
      invalid LaTeX and KaTeX shows red error text) gets "?" instead. The quiz page turns "?" into a visible blank
      and the practice page splits on it, so both pages work. Strings the quiz page shows as plain text (they hold
      words or commas) keep "___": it renders fine there and is a useful visual cue. A "___" inside a $...$ span is
      moved outside the span when both halves stay balanced.
  R2  instruction / hint / operation_description / word problem / lesson text: "___" INSIDE a $...$ span becomes
      "\\_\\_\\_" (the cue is kept; a bare "_" run throws in KaTeX). "___" in plain prose is left untouched.
  R3  backticks around math (`$2$`) are removed (a code span is not rendered as math).
  R4  control characters left by JSON-unescaped LaTeX (form feed + "rac" for \\frac, etc.) are turned back into the
      command.
  R5  double-escaped commands (\\\\frac) become \\frac.

Usage (dry run is the default and writes nothing to the database):
  python knowledge_base/fix_stored_katex.py                 # report + before/after files in scratch/db_fix/
  python knowledge_base/fix_stored_katex.py --apply         # backs up, then updates changed rows in one transaction
"""

import argparse
import asyncio
import json
import os
import re
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
OUT_DIR = os.path.join(ROOT, "scratch", "db_fix")

PP_COLUMNS = ("id", "node_id", "problem_expr", "steps_json", "word_problem_text", "step_extras_json")
CR_COLUMNS = ("lesson_text", "worked_example", "guided_explanation", "simplified_lesson_text")

_SPAN = re.compile(r"\$([^$]+)\$")
_TICKS = re.compile(r"`([^`]*\$[^`]*)`")
_DOUBLE = re.compile(r"\\\\(?=[a-zA-Z])")
_BLANK = re.compile(r"_{2,}")
# a JSON "\f", "\t", "\b", "\r", "\v" that swallowed the start of a LaTeX command
_CTRL = {
    "\x0c": ("f", r"rac|orall|lat"),
    "\x09": ("t", r"ext|imes|heta|au|an|riangle|o(?![a-z])"),
    "\x08": ("b", r"eta|inom|ar|igg"),
    "\x0d": ("r", r"ight|ho"),
    "\x0b": ("v", r"ec|arepsilon|ee"),
}


def requires_text_input(val: str) -> bool:
    """Port of requiresTextInput in quiz/page.tsx."""
    without = re.sub(r"\\[a-zA-Z]+", "", val)
    return bool(re.search(r"[a-zA-Z]{2,}", without)) or "," in without


def fix_control_chars(s: str) -> str:
    for ch, (letter, rest) in _CTRL.items():
        s = re.sub(r"\\?" + re.escape(ch) + r"(?=(?:" + rest + "))", "\\\\" + letter, s)
    return s


def fix_underscores_in_spans(s: str) -> str:
    def span(m):
        return "$" + re.sub(r"(?<!\\)_{2,}", lambda u: "\\_" * len(u.group(0)), m.group(1)) + "$"

    return _SPAN.sub(span, s)


def fix_text(s):
    """R2-R5 for any prose or value field."""
    if not isinstance(s, str) or not s:
        return s
    s = fix_control_chars(s)
    s = _DOUBLE.sub(r"\\", s)
    s = _TICKS.sub(lambda m: m.group(1), s)
    return fix_underscores_in_spans(s)


def _balanced(piece: str) -> bool:
    return piece.count("{") == piece.count("}") and piece.count("(") == piece.count(")")


def fix_blank(b):
    """R1. Returns the string unchanged when it needs no fix or cannot be fixed mechanically."""
    if not isinstance(b, str) or not _BLANK.search(b) or "?" in b:
        return b
    b = re.sub(r"\$\$(.+?)\$\$", lambda m: "$" + m.group(1) + "$", b)  # the quiz page does this at render time too
    if "$" not in b:
        # the quiz page wraps a bare string in $...$ unless it is word-like: only then does "___" throw
        return b if requires_text_input(b) else _BLANK.sub("?", b, count=1)
    m = _BLANK.search(b)
    before, after = b[: m.start()], b[m.end():]
    if before.count("$") % 2 == 0:
        return b  # the blank is already outside any span: plain text "___", which renders fine
    left, right = before + "$", "$" + after
    if not (_balanced(before) and _balanced(after)):
        return b  # blank inside \frac{..}{___} / ^{..}: the practice page cannot split there; needs regeneration
    out = (left + " ? " + right).replace("$ $", "$ $")
    out = re.sub(r"\$\s*\$", "", out)  # drop spans that became empty
    return re.sub(r"\s+", " ", out).strip()


def fix_steps(steps_json):
    steps = json.loads(steps_json)
    for s in steps:
        for key in ("instruction", "operation_description", "correct_value"):
            if key in s:
                s[key] = fix_text(s[key])
        if "blank_expression" in s:
            s["blank_expression"] = fix_blank(fix_text_keep_blank(s["blank_expression"]))
    return json.dumps(steps, ensure_ascii=False)


def fix_text_keep_blank(b):
    """R3-R5 on a blank_expression, without touching its blank marker."""
    if not isinstance(b, str):
        return b
    b = fix_control_chars(b)
    b = _DOUBLE.sub(r"\\", b)
    return _TICKS.sub(lambda m: m.group(1), b)


def fix_extras(extras_json):
    extras = json.loads(extras_json)
    for e in extras.values():
        if "hint" in e:
            e["hint"] = fix_text(e["hint"])
        e["distractors"] = [fix_text(d) for d in e.get("distractors", [])]
    return json.dumps(extras, ensure_ascii=False)


def fix_practice_row(row: dict):
    """-> (new column values, list of rule tags that changed something)."""
    new = {}
    if row.get("word_problem_text"):
        new["word_problem_text"] = fix_text(row["word_problem_text"])
    if row.get("steps_json"):
        new["steps_json"] = fix_steps(row["steps_json"])
    if row.get("step_extras_json"):
        new["step_extras_json"] = fix_extras(row["step_extras_json"])
    changed = {k: v for k, v in new.items() if v != row.get(k)}
    return changed


def fix_content_row(row: dict) -> dict:
    return {c: fix_text(row[c]) for c in CR_COLUMNS if isinstance(row.get(c), str) and fix_text(row[c]) != row[c]}


async def run(apply: bool):
    import asyncpg
    from dotenv import load_dotenv

    load_dotenv(os.path.join(ROOT, ".env"))
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("ERROR: DATABASE_URL not set (never printed by this script).")
    conn = await asyncpg.connect(dsn, statement_cache_size=0)
    try:
        pp = [dict(r) for r in await conn.fetch(f"SELECT {', '.join(PP_COLUMNS)} FROM practice_problems")]
        cr = [dict(r) for r in await conn.fetch(f"SELECT id, {', '.join(CR_COLUMNS)} FROM content_records")]
        pp = [r for r in pp if r["node_id"] != "_system"]
        pp_changes = {r["id"]: (r, fix_practice_row(r)) for r in pp}
        pp_changes = {k: v for k, v in pp_changes.items() if v[1]}
        cr_changes = {r["id"]: (r, fix_content_row(r)) for r in cr}
        cr_changes = {k: v for k, v in cr_changes.items() if v[1]}

        os.makedirs(OUT_DIR, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        report = {
            "practice_problems": [{"id": k, "node_id": r["node_id"], "before": {c: r[c] for c in ch}, "after": ch}
                                  for k, (r, ch) in pp_changes.items()],
            "content_records": [{"id": k, "before": {c: r[c] for c in ch}, "after": ch}
                                for k, (r, ch) in cr_changes.items()],
        }
        path = os.path.join(OUT_DIR, f"before_after_{stamp}.json")
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(report, f, indent=1, ensure_ascii=False)
        # full post-fix copy of every practice row, for the render check
        fixed_all = [dict(r, **pp_changes[r["id"]][1]) if r["id"] in pp_changes else r for r in pp]
        with open(os.path.join(OUT_DIR, "practice_problems_fixed.json"), "w", encoding="utf-8", newline="\n") as f:
            json.dump(fixed_all, f, ensure_ascii=False)
        print(f"practice_problems: {len(pp)} rows read, {len(pp_changes)} would change")
        print(f"content_records:   {len(cr)} rows read, {len(cr_changes)} would change")
        print(f"before/after written to {path}")
        if not apply:
            print("dry run: nothing written to the database (use --apply)")
            return

        async with conn.transaction():
            n = 0
            for k, (r, ch) in pp_changes.items():
                sets = ", ".join(f"{c} = ${i + 2}" for i, c in enumerate(ch))
                # only update a row that has not changed since it was read
                res = await conn.execute(
                    f"UPDATE practice_problems SET {sets} WHERE id = $1 AND steps_json = ${len(ch) + 2}",
                    k, *ch.values(), r["steps_json"])
                n += int(res.split()[-1])
            m = 0
            for k, (r, ch) in cr_changes.items():
                sets = ", ".join(f"{c} = ${i + 2}" for i, c in enumerate(ch))
                res = await conn.execute(f"UPDATE content_records SET {sets} WHERE id = $1", k, *ch.values())
                m += int(res.split()[-1])
        print(f"APPLIED: {n} practice_problems rows, {m} content_records rows updated (backup: {path})")
    finally:
        await conn.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="write the fixes (default is a dry run)")
    asyncio.run(run(ap.parse_args().apply))
