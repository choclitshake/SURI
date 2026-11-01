"""
Generate, validate, review and export the challenge items for the diagnostic and quiz banks
(ClickUp CU-14ypx624mw5).

Subcommands (all resumable; cached output lives in knowledge_base/challenge/work/, which is gitignored):
  diagnostic  one Gemini call per node asking for 12 candidate MCQs (keep 8 after validation)
  quiz        one call per candidate problem (7 per node, keep 5) plus one extras call (distractors + hints)
  validate    deterministic checks, blind re-solve, and the variety rules; writes work/validated/*.json
  review      writes work/review.md for a human to read
  export      appends diagnostic items, writes the quiz JSON and seed SQL

All commands take --nodes L1V,SLE (default: every in-scope node; nodes outside IN_SCOPE, such as PD, are rejected).
Run with C:\\Python314\\python.exe from the repo root.
"""

import argparse
import difflib
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from challenge_specs import (  # noqa: E402
    AGE_NODES, CHALLENGE_NOTES, GLOBAL_RULES, IN_SCOPE, SPECS, kinds_for, pdfs_for,
)
from gemini_pacing import EmptyResponse, Gemini, StopRun, calls_today  # noqa: E402
from katex_format import (  # noqa: E402
    ascii_to_katex, katexify_prose, outside_math_is_clean, to_blank, to_value,
)
from pg_common import BLIND_MODEL, ROOT, load_json, save_json  # noqa: E402

from backend.graph import GRAPH  # noqa: E402
from generate_playground import parse_gemini_json as _shared_parse  # noqa: E402
from pdf_text import grounding_text  # noqa: E402
from validate_playground import _NOT_ENGLISH, EvalError, Verifier, close_enough  # noqa: E402

WORK = os.path.join(HERE, "work")
CAND_DIR = os.path.join(WORK, "cand")
VALID_DIR = os.path.join(WORK, "validated")
REVIEW_MD = os.path.join(WORK, "review.md")
DECISIONS = os.path.join(HERE, "review_decisions.json")
PROBES_PATH = os.path.join(ROOT, "backend", "data", "diagnostic_probes.json")
PRACTICE_JSON = os.path.join(HERE, "challenge_practice_problems.json")
SEED_SQL = os.path.join(ROOT, "scripts", "seed_challenge_problems.sql")
RUNNER_JS = os.path.join(ROOT, "mathsteps_runner", "runner.js")

DIAG_CANDIDATES, DIAG_KEEP, DIAG_CAP_PER_KIND = 12, 8, 2
QUIZ_CANDIDATES, QUIZ_KEEP, QUIZ_CAP_PER_KIND = 7, 5, 1
CAP_PER_CONTEXT = 2
BLIND_ONLY_CAP = 4  # diagnostic items verified only by the blind solve (statement options, spot-the-error)
MIN_PATTERNS = 3
MAX_STEPS = 8
SLM_CAP = 12000
AGE_RE = re.compile(r"\b(years? old|ages?|aged|older than|younger than)\b", re.I)

MATH_FORMAT = r"""MATH FORMATTING: wrap ALL math (variables, numbers with operators, equations) in single dollar signs for
inline KaTeX, e.g. $x$, $3x + 2$, $\\frac{3}{4}$, $\\sqrt{50}$, $x^{3/2}$, $2^{10}$. Plain English words are never wrapped.
Options contain ONLY the mathematical answer (a number, an expression, or a solution), with no units or words;
put units in the question text. (Exception: kinds marked MCQ-only may use short statements as options.)"""

CHECK_FORMATS = """\
`check` is machine-checkable truth, written in mathjs syntax (explicit * for multiplication, ^ for powers, sqrt(), nthRoot(x, n)).
Use ONE of:
  {"kind": "eval",   "expr": "3*12 - 4"}                                   (the answer is that number)
  {"kind": "solve",  "eq": "x + (x+4) + 2*x = 40", "variable": "x", "roots": [9], "answer_expr": "2*x"}
        (roots are plain decimal numbers in JSON, e.g. -2.7320508, never expressions; every root must satisfy eq; answer_expr is optional and gives the quantity actually asked for, in terms of the variable)
  {"kind": "system", "eqs": ["x + y = 10", "2*x + 3*y = 26"], "solution": {"x": 4, "y": 6}, "answer_vars": ["x", "y"]}
  {"kind": "expr",   "expr": "x^2 + 5*x + 6", "vars": ["x"]}              (the answer is an expression equal to this)"""
CHECK_MANUAL = '''
  {"kind": "manual"}                                                       (ONLY for MCQ-only kinds, e.g. spot the error)'''


def parse_gemini_json(raw: str):
    """Parse a model response. Lone backslashes (LaTeX the model forgot to escape) are fixed without
    touching valid escape pairs, which the shared parser's repair would corrupt."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # valid escapes are matched (and kept) pairwise; only a lone backslash is doubled
    fixed = re.sub(r'\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|\\', lambda m: m.group(0) if len(m.group(0)) > 1 else "\\\\", text)
    for candidate in (fixed, _evaluate_bare_numbers(fixed)):
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return _shared_parse(raw)


def _evaluate_bare_numbers(text: str) -> str:
    """Turn array elements the model wrote as arithmetic (e.g. -1 - sqrt(3),) into decimal numbers."""
    import math

    def repl(m):
        expr = m.group(2)
        try:
            value = eval(expr.replace("sqrt", "math.sqrt"), {"__builtins__": {}, "math": math})  # noqa: S307
            return f"{m.group(1)}{value!r}{m.group(3)}"
        except Exception:
            return m.group(0)

    # only lines made solely of digits, + - * / ( ) . spaces and sqrt, containing an operator or sqrt
    return re.sub(r"(?m)^(\s*)([-+0-9.()* /]*(?:sqrt\([-+0-9.* /()]*\)[-+0-9.()* /]*)+|[-+]?[0-9.]+(?:\s*[-+*/]\s*[0-9.()]+)+)(,?\s*)$",
                  repl, text)


# --- text -> numbers ---------------------------------------------------------------------

def to_ascii(text: str) -> str:
    """Convert the small KaTeX/plain subset used in answers into mathjs syntax."""
    s = str(text).replace("$", "")
    s = re.sub(r"\\text\{[^}]*\}", "", s)
    s = re.sub(r"\\(left|right|,|;|!)", "", s)
    s = s.replace("\\%", "").replace("%", "").replace("\\cdot", "*").replace("\\times", "*")
    s = s.replace("\u00d7", "*").replace("\u00b7", "*").replace("\u2212", "-").replace("\u20b1", "")
    s = re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "", s)
    s = re.sub(r"\b(or|and)\b", ",", s)
    for _ in range(6):
        s = re.sub(r"\\d?frac\{([^{}]*)\}\{([^{}]*)\}", r"((\1)/(\2))", s)
        s = re.sub(r"\\sqrt\[(\d+)\]\{([^{}]*)\}", r"nthRoot(\2,\1)", s)
        s = re.sub(r"\\sqrt\{([^{}]*)\}", r"sqrt(\1)", s)
        s = re.sub(r"\^\{([^{}]*)\}", r"^(\1)", s)
    s = s.replace("{", "(").replace("}", ")").replace("\\", "")
    s = re.sub(r"[A-Za-z]{2,}", lambda m: m.group(0) if m.group(0) in ("sqrt", "nthRoot") else "", s)
    s = re.sub(r"(\d)\s*(?=[A-Za-z(])", r"\1*", s)
    s = re.sub(r"(\))\s*(?=[A-Za-z\d(])", r"\1*", s)
    s = re.sub(r"(?<![A-Za-z])([a-z])\(", r"\1*(", s)
    return s.strip()


def split_top(s: str) -> list:
    parts, depth, cur = [], 0, ""
    for ch in s:
        depth += ch == "("
        depth -= ch == ")"
        if ch in ",;" and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def numbers_in(v, text: str):
    """All numeric values in an answer text ('x = 2 or x = 5', '(4, 6)', '12 pesos'), or None if unparseable."""
    s = to_ascii(text)
    if s.startswith("(") and s.endswith(")") and "," in s and s[1:-1].count("(") == s[1:-1].count(")"):
        s = s[1:-1]
    out = []
    for frag in split_top(s):
        frag = re.sub(r"^\s*[a-zA-Z]\s*=\s*", "", frag)
        try:
            out.append(float(v.eval(frag)))
        except Exception:
            return None
    return out or None


def same_numbers(a, b) -> bool:
    return len(a) == len(b) and all(close_enough(x, y) for x, y in zip(sorted(a), sorted(b)))


# --- check kinds -------------------------------------------------------------------------

def expected_values(v, check: dict):
    """The numbers a correct answer must contain, derived from machine-checkable truth. Raises EvalError."""
    kind = check.get("kind")
    if kind == "eval":
        return [float(v.eval(check["expr"]))]
    if kind == "solve":
        var, roots = check["variable"], [float(r) for r in check.get("roots", [])]
        if not roots:
            raise EvalError("solve check without roots")
        for r in roots:
            if abs(v.residual(check["eq"], {var: r})) > 1e-6:
                raise EvalError(f"{var}={r} does not satisfy {check['eq']}")
        # mathsteps only solves linear equations reliably; it returns nonsense for quadratics and cubics
        linear = not re.search(r"\^|\)\s*\*\s*\(|[a-z]\s*\*\s*[a-z(]|\)\s*\*\s*[a-z]", check["eq"])
        solved = v.solve(check["eq"]) if linear else None
        if solved and not same_numbers(solved["roots"], roots):
            raise EvalError(f"mathsteps roots {solved['roots']} differ from claimed {roots}")
        expr = check.get("answer_expr")
        return [float(v.eval(expr, {var: r})) for r in roots] if expr else roots
    if kind == "system":
        sol = {k: float(x) for k, x in check["solution"].items()}
        for eq in check["eqs"]:
            if abs(v.residual(eq, sol)) > 1e-6:
                raise EvalError(f"solution does not satisfy {eq}")
        names = check.get("answer_vars") or sorted(sol)
        return [float(v.eval(n, sol)) for n in names]
    raise EvalError(f"unsupported check kind {kind!r}")


def check_matches(v, check: dict, text: str):
    """(True|False|None, reason). None means the check is manual and nothing was verified."""
    kind = check.get("kind")
    if kind == "manual":
        return None, "manual check"
    try:
        if kind == "expr":
            return expr_matches(v, check, text), "expression comparison"
        want = expected_values(v, check)
    except (EvalError, KeyError, TypeError, ValueError) as exc:
        return False, f"check failed: {exc!r}"
    got = numbers_in(v, text)
    if got is None:
        return False, f"cannot parse {text!r}"
    if same_numbers(got, want):
        return True, "matches"
    positive = [w for w in want if w > 0]
    if check.get("kind") == "solve" and 0 < len(positive) < len(want) and same_numbers(got, positive):
        return True, "matches the positive roots (context discards the others)"
    return False, f"expected {want}, answer has {got}"


def expr_matches(v, check: dict, text: str) -> bool:
    s = re.sub(r"^\s*[a-zA-Z]\s*=\s*", "", to_ascii(text))
    names = check.get("vars") or ["x"]
    rng = random.Random(7)
    for _ in range(3):
        scope = {n: rng.randint(2, 9) for n in names}
        try:
            if not close_enough(v.eval(s, scope), v.eval(check["expr"], scope)):
                return False
        except EvalError:
            return False
    return True


# --- prompts -----------------------------------------------------------------------------

def spec_block(node_id: str, kinds: list) -> str:
    spec = SPECS[node_id]
    lines = [f"- {k} [pattern: {p}]{' (MCQ-only)' if mcq else ''}" for k, p, mcq in kinds]
    age = ("Age problems are allowed here, but at most ONE." if node_id in AGE_NODES
           else "Do NOT write any age problem.")
    return (f"CHALLENGE KINDS for {spec['label']} (Grade {spec['grade']}):\n" + "\n".join(lines) +
            f"\nCONTEXTS you may draw on: {', '.join(spec['contexts'])} (any one context at most twice)."
            f"\nNOTES: {spec['notes']}\n{age}")


def common_rules(node_id: str) -> str:
    return (f"{CHALLENGE_NOTES}\nGLOBAL RULES:\n{GLOBAL_RULES}"
            "- Use ONLY methods shown in the SLM excerpt; nothing from outside the curriculum.\n"
            "- `slm_concept` (required) names the concept from the excerpt the item uses.\n"
            "- `relationships` (required) lists the stated conditions or facts the solver must combine (at least 2).\n"
            "- `context` (required) names the real-world setting used.\n")


def diag_prompt(node_id: str, n: int, existing: list, kinds: list, excerpt: str) -> str:
    spec = SPECS[node_id]
    return f"""You are an expert mathematics teacher writing CHALLENGE diagnostic questions for Filipino K-12 (DepEd) students.

Write exactly {n} distinct multiple-choice questions on: {spec['label']} (Grade {spec['grade']}).

SLM EXCERPT (the only source of methods you may use):
{excerpt}

{spec_block(node_id, kinds)}

Spread the {n} questions across the kinds and across at least 3 different patterns; use no kind more than twice.
{common_rules(node_id)}
Each question has exactly 4 options and exactly one correct option; distractors are common student mistakes and are all different.
{MATH_FORMAT}
{CHECK_FORMATS}{CHECK_MANUAL}

EXISTING QUESTIONS for this topic (do not write near-duplicates or reuse their numbers):
{chr(10).join('- ' + q for q in existing)}

Return ONLY a JSON array of {n} objects with keys:
"node_id": "{node_id}", "question_text", "options" (4 strings), "correct_option_index" (0-3), "difficulty": "challenge",
"kind" (copy one kind text exactly), "pattern", "context", "slm_concept", "relationships" (array of strings), "check".
Escape every backslash in the JSON (write \\\\frac for \\frac)."""


def quiz_prompt(node_id: str, kind: tuple, excerpt: str, context: str = "") -> str:
    spec = SPECS[node_id]
    return f"""You are an expert mathematics teacher writing ONE CHALLENGE practice problem for Filipino K-12 (DepEd) students on: {spec['label']} (Grade {spec['grade']}).

SLM EXCERPT (the only source of methods you may use):
{excerpt}

ASSIGNED KIND: {kind[0]}
ASSIGNED PATTERN: {kind[1]}
{('ASSIGNED CONTEXT: set the problem in this context (set `context` to it): ' + context) if context else ''}
{spec_block(node_id, [kind])}
{common_rules(node_id)}
The final answer must be ONE short typeable result (a number, an expression, or a solution set / ordered pair), with no units or words.
FORMATS: write prose (`word_problem`, each step `instruction`) with every piece of math inside single dollar signs for KaTeX,
e.g. "Let $x$ be the width. Write $2(x + 5) = 50$." Write `blank_expression`, `correct_value`, `answer`, `problem_expr` and `check`
in plain mathjs ASCII (explicit *, ^, /, sqrt()); they are converted to KaTeX afterwards. Use ___ for the blank.

The problem is solved in 4 to {MAX_STEPS} typed steps. Each step in `all_steps` has:
  "step_index" (0..n-1), "step_type" ("variable_identification" or "algebra"), "instruction" (short imperative),
  "blank_expression" (the line with ___ where the student types), "correct_value" (SHORT and typeable: a number, a simple
  expression or an equation; never a phrase), "operation_description", "mapped_node_id" (one of: {', '.join(sorted(GRAPH))}).
Start with 1-2 "variable_identification" steps (name the unknown, write the equation or system), then "algebra" steps.
EVERY step's "blank_expression" MUST contain exactly one ___ in the place the student types, and must NOT already show the
correct_value. Example steps for "2x + 7 = 35":
  {{"step_type": "variable_identification", "instruction": "Let x be the number. Write the equation.", "blank_expression": "___ = 35", "correct_value": "2*x + 7"}}
  {{"step_type": "algebra", "instruction": "Subtract 7 from both sides.", "blank_expression": "2*x = ___", "correct_value": "28"}}
  {{"step_type": "algebra", "instruction": "Divide both sides by 2.", "blank_expression": "x = ___", "correct_value": "14"}}
A variable_identification step may instead use "blank_expression": "Let x = ___" with correct_value naming the quantity as a short symbol or expression.
Use 4 to 8 steps; split the reasoning so each step has one small move.
The LAST step's correct_value must equal `answer`. Do not put the answer or the steps in `word_problem`.
Use plain text math in correct_value (e.g. 2*x + 3 = 11, x = 4) so it can be typed on a keyboard.
`problem_expr` is the equation or system a student would write; for a system write "eq1, eq2".
{CHECK_FORMATS}

Return ONLY a JSON object with keys:
"node_id": "{node_id}", "kind": "{kind[0]}", "pattern": "{kind[1]}", "context", "slm_concept", "relationships" (array of strings),
"word_problem", "problem_expr", "answer", "check", "all_steps".
Escape every backslash in the JSON."""


def extras_prompt(c: dict, mathsteps_json: str) -> str:
    blocks = ""
    for s in c["all_steps"]:
        blocks += (f"\n--- STEP {s['step_index']} ---\nInstruction: {s['instruction']}\n"
                   f"Blank expression: {s['blank_expression']}\nCorrect answer: {s['correct_value']}\n"
                   f"Operation: {s['operation_description']}\nStep type: {s['step_type']}\n")
    keys = ", ".join(f'"{s["step_index"]}"' for s in c["all_steps"])
    return (
        "You are generating quiz data for a Philippine JHS math practice system.\n\n"
        f"PROBLEM EXPRESSION: {c['problem_expr']}\nWORD PROBLEM: {c['word_problem']}\n"
        f"MATHSTEPS OUTPUT (may be empty): {mathsteps_json}\n\n"
        f"This problem has {len(c['all_steps'])} step(s):\n{blocks}\n"
        "TASK: For EACH step above generate:\n"
        "1. Exactly 3 WRONG but PLAUSIBLE answer choices (distractors): realistic student mistakes (sign error, wrong operation,\n"
        "   off-by-one), in the SAME format as the correct answer, never equal to it, never vague ('N/A', 'cannot determine').\n"
        "2. A 1-2 sentence HINT that points at the concept or operation without giving away the correct answer;\n"
        "   put any math in the hint inside $...$ (KaTeX). Write distractors in plain mathjs ASCII like the correct answer.\n\n"
        f"Return ONLY a single JSON object keyed by step index ({keys}), like:\n"
        '{"0": {"distractors": ["wrong1", "wrong2", "wrong3"], "hint": "hint text"}}\n'
        "No markdown, no code fences. Escape every backslash in the JSON."
    )


def run_mathsteps(expr: str) -> list:
    """simplifyExpression output for the prompt, as generate_practice.py does; empty if mathsteps cannot parse it."""
    try:
        out = subprocess.run(["node", RUNNER_JS, expr], capture_output=True, text=True, timeout=20,
                             cwd=os.path.dirname(RUNNER_JS))
        data = json.loads(out.stdout or "[]")
        return data if isinstance(data, list) else []
    except Exception:
        return []


# --- candidate files ---------------------------------------------------------------------

def cand_path(bank: str, node_id: str) -> str:
    return os.path.join(CAND_DIR, f"{bank}_{node_id}.json")


def load_cands(bank: str, node_id: str) -> list:
    return load_json(cand_path(bank, node_id), []) or []


def existing_questions(node_id: str) -> list:
    probes = load_json(PROBES_PATH, {})
    return [p["question_text"] for p in probes.get(node_id, []) if p.get("difficulty", "standard") != "challenge"]


def parse_list(raw: str):
    data = parse_gemini_json(raw)
    if isinstance(data, dict):
        data = data.get("questions") or data.get("items") or [data]
    return data


def kind_order(node_id: str, mcq: bool, rng_seed: str) -> list:
    kinds = list(kinds_for(node_id, mcq))
    random.Random(rng_seed).shuffle(kinds)
    return kinds


# --- generation --------------------------------------------------------------------------

def gen_diagnostic(gem: Gemini, node_id: str, topup: bool = False):
    cands = load_cands("diag", node_id)
    n, tag = DIAG_CANDIDATES, f"diag-{node_id}"
    kinds = kinds_for(node_id, True)
    if topup:
        report = load_json(os.path.join(VALID_DIR, f"diag_{node_id}.json"))
        if not report or not report.get("shortfall"):
            print(f"  {node_id}: nothing to top up")
            return
        used = {k["kind"] for k in report["kept"]}
        kinds = [k for k in kinds if k[0] not in used] or kinds
        n = report["shortfall"] + 2
        tag = f"diag-{node_id}-topup{len(cands)}"
    elif cands:
        print(f"  {node_id}: diagnostic candidates exist ({len(cands)}), skipping")
        return
    prompt = diag_prompt(node_id, n, existing_questions(node_id), kinds,
                         grounding_text(pdfs_for(node_id), cap=SLM_CAP))
    raw = gem.call(tag, prompt, max_output_tokens=8192)
    for item in parse_list(raw):
        item["node_id"] = node_id
        item["difficulty"] = "challenge"
        item["cand_id"] = f"diag-{node_id}-{len(cands):02d}"
        item["topup"] = topup
        cands.append(item)
    save_json(cand_path("diag", node_id), cands)
    print(f"  {node_id}: {len(cands)} diagnostic candidates")


def normalize_steps(steps: list) -> list:
    out = []
    for i, s in enumerate(steps or []):
        s = dict(s)
        if "step_type" not in s and "type" in s:
            s["step_type"] = s.pop("type")
        s["step_type"] = "variable_identification" if "var" in str(s.get("step_type", "")) else "algebra"
        s["step_index"] = i
        for key in ("instruction", "blank_expression", "correct_value", "operation_description"):
            s[key] = str(s.get(key, "")).strip()
        s["mapped_node_id"] = s.get("mapped_node_id") if s.get("mapped_node_id") in GRAPH else None
        out.append(s)
    return out


def gen_quiz(gem: Gemini, node_id: str, topup: bool = False):
    cands = load_cands("quiz", node_id)
    excerpt = grounding_text(pdfs_for(node_id), cap=SLM_CAP)
    kinds = kind_order(node_id, False, node_id)
    if topup:
        report = load_json(os.path.join(VALID_DIR, f"quiz_{node_id}.json"))
        if not report or not report.get("shortfall"):
            print(f"  {node_id}: nothing to top up")
            return
        used = {k["kind"] for k in report["kept"]}
        kinds = [k for k in kinds if k[0] not in used] or kinds
        wanted = report["shortfall"]
        jobs = [(len(cands) + i, kinds[i % len(kinds)]) for i in range(wanted)]
    else:
        jobs = [(i, kinds[i % len(kinds)]) for i in range(QUIZ_CANDIDATES) if i >= len(cands)]
    v = Verifier()
    try:
        for item in cands:
            if item.get("pre_drop") and not item.get("extras") and not item.get("error"):
                if quiz_core_checks(item, v, node_id):
                    continue
                item.pop("pre_drop")
                steps = run_mathsteps(item["problem_expr"].split(",")[0])
                raw_x = gem.call("extras-" + item["cand_id"], extras_prompt(item, json.dumps(steps)), max_output_tokens=4096)
                try:
                    item["extras"] = parse_gemini_json(raw_x)
                except Exception as exc:
                    item["pre_drop"] = [f"extras unparseable: {exc}"]
                save_json(cand_path("quiz", node_id), cands)
        for idx, kind in jobs:
            cid = f"quiz-{node_id}-{idx:02d}"
            contexts = SPECS[node_id]["contexts"]
            raw = gem.call(cid, quiz_prompt(node_id, kind, excerpt, contexts[idx % len(contexts)]),
                           max_output_tokens=4096)
            try:
                item = parse_gemini_json(raw)
                if isinstance(item, list):
                    item = item[0]
                item["all_steps"] = normalize_steps(item.get("all_steps"))
            except Exception as exc:
                cands.append({"cand_id": cid, "node_id": node_id, "error": f"unparseable: {exc}"})
                save_json(cand_path("quiz", node_id), cands)
                continue
            item.update(node_id=node_id, cand_id=cid, difficulty="challenge", topup=topup)
            item.setdefault("kind", kind[0])
            item.setdefault("pattern", kind[1])
            reasons = quiz_core_checks(item, v, node_id)
            if reasons:
                item["pre_drop"] = reasons
            else:
                steps = run_mathsteps(item["problem_expr"].split(",")[0])
                raw_x = gem.call("extras-" + cid, extras_prompt(item, json.dumps(steps)), max_output_tokens=4096)
                try:
                    item["extras"] = parse_gemini_json(raw_x)
                except Exception as exc:
                    item["pre_drop"] = [f"extras unparseable: {exc}"]
            cands.append(item)
            save_json(cand_path("quiz", node_id), cands)
            print(f"  {cid}: {'dropped ' + str(item['pre_drop']) if item.get('pre_drop') else 'ok'}")
    finally:
        v.close()


# --- validation --------------------------------------------------------------------------

def norm_text(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", re.sub(r"\$", "", str(s).lower())).strip()


def norm_math(s: str) -> str:
    """Equality key for answers/options: keeps operators (2*x + 4 differs from 2*x - 4)."""
    return re.sub(r"[\s$]|\\left|\\right", "", str(s).lower())


def big_numbers(text: str) -> set:
    return {n for n in re.findall(r"\d+(?:\.\d+)?", str(text)) if "." in n or len(n) >= 2}


def numbers_overlap(a: str, b: str) -> bool:
    na, nb = big_numbers(a), big_numbers(b)
    return len(na) >= 3 and len(nb) >= 3 and len(na & nb) / min(len(na), len(nb)) >= 0.7


def english_ok(text: str) -> bool:
    return len(_NOT_ENGLISH.findall(re.sub(r"\$[^$]*\$", " ", text))) < 3


def answer_leaks(prompt: str, answer_texts: list) -> bool:
    """True if a multi-digit answer number appears verbatim in the prompt."""
    nums = set()
    for t in answer_texts:
        nums |= {n for n in re.findall(r"\d+(?:\.\d+)?", str(t)) if len(n) >= 3 or "." in n}
    return any(re.search(rf"(?<![\d.]){re.escape(n)}(?![\d.])", prompt) for n in nums)


def canon_kind(node_id: str, is_diag: bool, kind) -> tuple:
    """Match a (possibly reworded) kind to the nearest spec kind -> (kind, pattern) or (None, None)."""
    best, score = None, 0.0
    for k in kinds_for(node_id, is_diag):
        r = difflib.SequenceMatcher(None, norm_text(kind), norm_text(k[0])).ratio()
        if r > score:
            best, score = k, r
    return (best[0], best[1]) if best and score >= 0.45 else (None, None)


def common_checks(c: dict, node_id: str, is_diag: bool) -> list:
    reasons = []
    kind, pattern = canon_kind(node_id, is_diag, c.get("kind", ""))
    if kind:
        c["kind"], c["pattern"] = kind, pattern  # the spec's pattern, not the model's free text
    if not str(c.get("slm_concept", "")).strip():
        reasons.append("missing slm_concept")
    rel = c.get("relationships")
    if not isinstance(rel, list) or len(rel) < 2:
        reasons.append("fewer than 2 stated relationships")
    if not str(c.get("context", "")).strip():
        reasons.append("missing context")
    if not kind:
        reasons.append("kind is not one of the node's specs")
    text = c.get("question_text") if is_diag else c.get("word_problem")
    if not text or not english_ok(str(text)):
        reasons.append("missing or non-English text")
    if text and AGE_RE.search(str(text)):
        if node_id not in AGE_NODES:
            reasons.append("age problem not allowed in this node")
        elif "age problem" not in str(c.get("kind", "")):
            reasons.append("age problem outside its own kind")
    if not isinstance(c.get("check"), dict):
        reasons.append("missing check")
    return reasons


def diag_core_checks(c: dict, v, node_id: str, existing: list) -> list:
    reasons = common_checks(c, node_id, True)
    opts = c.get("options")
    idx = c.get("correct_option_index")
    if isinstance(idx, str) and idx.strip():
        idx = "ABCD".index(idx.strip().upper()) if idx.strip().upper() in "ABCD" and len(idx.strip()) == 1 \
            else (int(idx) if idx.strip().isdigit() else idx)
    if isinstance(idx, float) and idx.is_integer():
        idx = int(idx)
    if not (isinstance(opts, list) and len(opts) == 4 and all(str(o).strip() for o in opts)):
        return reasons + ["options must be 4 non-empty strings"]
    if not isinstance(idx, int) or isinstance(idx, bool) or not 0 <= idx <= 3:
        return reasons + ["bad correct_option_index"]
    c["correct_option_index"] = idx
    if len({norm_math(o) for o in opts}) != 4:
        reasons.append("duplicate options")
    c["blind_only"] = False
    if isinstance(c.get("check"), dict):
        if c["check"].get("kind") == "manual":
            c["blind_only"] = True  # statement-style options: verified by the blind solve, flagged in the review
        else:
            results = [check_matches(v, c["check"], o) for o in opts]
            if all(not ok and "cannot parse" in why for ok, why in results):
                c["blind_only"] = True  # options are statements ("Package A by 2 pesos"), not numbers
            else:
                for i, (ok, why) in enumerate(results):
                    if i == idx and not ok:
                        reasons.append(f"correct option fails check ({why})")
                    if i != idx and ok:
                        reasons.append(f"distractor {i} also satisfies the check")
    q = str(c.get("question_text", ""))
    if answer_leaks(q, [opts[idx]]):
        reasons.append("question contains the answer")
    for e in existing:
        if difflib.SequenceMatcher(None, norm_text(q), norm_text(e)).ratio() > 0.8 or numbers_overlap(q, e):
            reasons.append("near-duplicate of an existing question")
            break
    return reasons


def quiz_core_checks(c: dict, v, node_id: str) -> list:
    """Deterministic checks that need no extras (also run before the extras call to save budget)."""
    reasons = common_checks(c, node_id, False)
    steps = c.get("all_steps") or []
    for key in ("problem_expr", "answer"):
        if not str(c.get(key, "")).strip():
            reasons.append(f"missing {key}")
    if not 4 <= len(steps) <= MAX_STEPS:
        reasons.append(f"needs 4-{MAX_STEPS} steps, has {len(steps)}")
    if not any(s["step_type"] == "variable_identification" for s in steps):
        reasons.append("no variable_identification step")
    for s in steps:
        words = re.sub(r"\\[a-zA-Z]+|sqrt|nthRoot", "", s["correct_value"])
        if not s["correct_value"] or len(s["correct_value"]) > 40 or re.search(r"[A-Za-z]{2,}", words):
            reasons.append(f"step {s['step_index']} correct_value is not short and typeable")
        if s["mapped_node_id"] is None:
            s["mapped_node_id"] = node_id  # same fallback as generate_practice.validate_and_fix
        cv, be = s["correct_value"], s["blank_expression"]
        if "___" not in be and "?" not in be and cv and be.count(cv) == 1:
            s["blank_expression"] = be.replace(cv, "___")  # the model left the answer in place: blank it out
        if "___" not in s["blank_expression"]:
            reasons.append(f"step {s['step_index']} blank_expression has no ___")
    if reasons:
        return reasons
    check = c["check"]
    if check.get("kind") == "manual":
        return ["manual check not allowed for quiz problems"]
    ok, why = check_matches(v, check, c["answer"])
    if not ok:
        reasons.append(f"answer fails check ({why})")
    ok, why = check_matches(v, check, steps[-1]["correct_value"])
    if not ok and steps[-1]["correct_value"].replace(" ", "") != str(c["answer"]).replace(" ", ""):
        reasons.append(f"last step does not equal the answer ({why})")
    for s in steps:  # numeric steps: a fully numeric equation with the blank filled in must balance
        filled = s["blank_expression"].replace("___", f"({s['correct_value']})")
        if filled.count("=") == 1 and "=" not in s["correct_value"]:
            try:
                if abs(v.residual(to_ascii(filled), {})) > 1e-6:
                    reasons.append(f"step {s['step_index']} does not balance when filled in")
            except Exception:
                pass
    if answer_leaks(str(c.get("word_problem", "")), [c["answer"]]):
        reasons.append("word problem contains the answer")
    return reasons


def extras_checks(c: dict) -> list:
    reasons = []
    extras = c.get("extras")
    if not isinstance(extras, dict):
        return ["no extras"]
    vague = {"n/a", "na", "cannot be determined", "cannot determine", "not possible", "undefined", "none",
             "not applicable", "indeterminate", "unknown", "error", "invalid", "does not exist"}
    for s in c["all_steps"]:
        e = extras.get(str(s["step_index"]))
        if not isinstance(e, dict):
            reasons.append(f"step {s['step_index']} has no extras")
            continue
        d = [str(x).strip() for x in e.get("distractors", [])]
        correct = norm_math(s["correct_value"])
        if len(d) != 3 or len({norm_math(x) for x in d}) != 3 or not all(d):
            reasons.append(f"step {s['step_index']} needs 3 distinct non-empty distractors")
        elif any(norm_math(x) == correct or norm_text(x) in vague for x in d):
            reasons.append(f"step {s['step_index']} has a distractor equal to the answer or vague")
        if not str(e.get("hint", "")).strip():
            reasons.append(f"step {s['step_index']} has no hint")
    return reasons


def blind_diag_prompt(batch: list) -> str:
    blocks = []
    for c in batch:
        opts = "\n".join(f"   {'ABCD'[i]}. {o}" for i, o in enumerate(c["options"]))
        blocks.append(f'- id "{c["cand_id"]}"\n  {c["question_text"]}\n{opts}')
    return ("Answer each multiple-choice math question. Give ONLY the letter of the correct option.\n\n" +
            "\n".join(blocks) + '\n\nReturn ONLY a JSON array of {"id": "...", "answer": "A"}.')


def blind_quiz_prompt(batch: list) -> str:
    blocks = [f'- id "{c["cand_id"]}"\n  {c["word_problem"]}' for c in batch]
    return ("Solve each math problem carefully. Give ONLY the final answer, short, with no units or words "
            "(a number, an expression, or a solution set).\n\n" + "\n".join(blocks) +
            '\n\nReturn ONLY a JSON array of {"id": "...", "answer": "..."}. Escape every backslash in the JSON.')


def blind_solve(gem: Gemini, bank: str, node_id: str, items: list) -> dict:
    """{cand_id: blind answer} in batches of about 6, cached per batch."""
    out = {}

    def solve(batch):
        prompt = (blind_diag_prompt if bank == "diag" else blind_quiz_prompt)(batch)
        tag = f"blind-{bank}-{node_id}-{hashlib.sha256(prompt.encode()).hexdigest()[:10]}"
        try:
            raw = gem.call(tag, prompt, max_output_tokens=4096, model=BLIND_MODEL, temperature=0.0)
        except EmptyResponse:
            if len(batch) > 1:  # one awkward item can blank the whole batch: retry them one at a time
                for single in batch:
                    solve([single])
            return  # a single item that still comes back empty gets no blind answer and is dropped
        try:
            for d in parse_gemini_json(raw):
                out[str(d.get("id"))] = str(d.get("answer", ""))
        except Exception:
            pass

    for b in range(0, len(items), 6):
        solve(items[b:b + 6])
    return out


def select_kept(survivors: list, target: int, kind_cap: int, node_id: str) -> tuple:
    """Greedy pick with the variety rules; the first item of each kind is considered before repeats."""
    seen_kind, ranked = {}, []
    for c in survivors:
        rank = seen_kind.get(c["kind"], 0)
        seen_kind[c["kind"]] = rank + 1
        ranked.append((rank, len(ranked), c))
    ranked.sort(key=lambda t: (t[0], t[1]))
    kept, dropped = [], []
    kinds, contexts = {}, {}
    ages = 0
    for _, _, c in ranked:
        ctx = norm_text(c.get("context", ""))
        is_age = "age problem" in str(c.get("kind", ""))
        why = None
        if len(kept) >= target:
            why = "not needed (set is full)"
        elif kinds.get(c["kind"], 0) >= kind_cap:
            why = f"kind used {kind_cap}x already"
        elif contexts.get(ctx, 0) >= CAP_PER_CONTEXT:
            why = "context used twice already"
        elif is_age and ages >= 1:
            why = "second age problem"
        elif c.get("blind_only") and sum(1 for k in kept if k.get("blind_only")) >= BLIND_ONLY_CAP:
            why = f"more than {BLIND_ONLY_CAP} blind-only items"
        elif any(difflib.SequenceMatcher(None, norm_text(c.get("question_text") or c.get("word_problem")),
                                         norm_text(k.get("question_text") or k.get("word_problem"))).ratio() > 0.8
                 or numbers_overlap(str(c.get("question_text") or c.get("word_problem")),
                                    str(k.get("question_text") or k.get("word_problem"))) for k in kept):
            why = "near-duplicate of a kept item"
        if why:
            dropped.append({"id": c["cand_id"], "reasons": [why]})
            continue
        kept.append(c)
        kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1
        contexts[ctx] = contexts.get(ctx, 0) + 1
        ages += is_age
    return kept, dropped


def validate_node(gem: Gemini, bank: str, node_id: str):
    cands = load_cands(bank, node_id)
    if not cands:
        print(f"  {node_id}: no {bank} candidates (run the generator first)")
        return
    target, cap = (DIAG_KEEP, DIAG_CAP_PER_KIND) if bank == "diag" else (QUIZ_KEEP, QUIZ_CAP_PER_KIND)
    existing = existing_questions(node_id) if bank == "diag" else []
    v = Verifier()
    survivors, dropped = [], []
    try:
        for c in cands:
            if c.get("error") or c.get("pre_drop"):
                dropped.append({"id": c["cand_id"], "reasons": [c.get("error") or "; ".join(c["pre_drop"])]})
                continue
            reasons = diag_core_checks(c, v, node_id, existing) if bank == "diag" else \
                quiz_core_checks(c, v, node_id) + extras_checks(c)
            if reasons:
                dropped.append({"id": c["cand_id"], "reasons": reasons})
            else:
                survivors.append(c)
        blind = blind_solve(gem, bank, node_id, survivors) if survivors else {}
        checked = []
        for c in survivors:
            got = blind.get(c["cand_id"])
            if bank == "diag":
                ok = got is not None and got.strip()[:1].upper() == "ABCD"[c["correct_option_index"]]
            elif got is None:
                ok = False
            else:
                ok = check_matches(v, c["check"], got)[0]
            if ok:
                c["verified_by"] = "blind only" if c.get("blind_only") else "check+blind"
                checked.append(c)
            else:
                dropped.append({"id": c["cand_id"], "reasons": [f"blind solve disagrees (got {got!r})"]})
    finally:
        v.close()
    kept, extra_dropped = select_kept(checked, target, cap, node_id)
    dropped += [d for d in extra_dropped if d["reasons"] != ["not needed (set is full)"]]
    patterns = {c["pattern"] for c in kept}
    shortfall = max(target - len(kept), 0)
    if len(patterns) < MIN_PATTERNS:
        shortfall = max(shortfall, 1)
    save_json(os.path.join(VALID_DIR, f"{bank}_{node_id}.json"),
              {"node_id": node_id, "bank": bank, "target": target, "kept": kept, "dropped": dropped,
               "patterns": sorted(patterns), "shortfall": shortfall})
    print(f"  {node_id}: kept {len(kept)}/{target}, {len(patterns)} patterns, dropped {len(dropped)}"
          + (f"  -> short by {shortfall}; run the generator with --topup" if shortfall else ""))


# --- stored (KaTeX) forms ----------------------------------------------------------------

SCOPE = {"x": 3, "y": 5, "w": 7, "n": 4, "a": 2, "b": 6}


def roundtrip_ok(v, original: str, final: str) -> bool:
    """The stored LaTeX must mean the same as the verified original (numbers or expressions)."""
    a, b = numbers_in(v, original), numbers_in(v, final)
    if a is not None and b is not None:
        return same_numbers(a, b)
    try:
        return close_enough(v.eval(to_ascii(original), SCOPE), v.eval(to_ascii(final), SCOPE))
    except Exception:
        return False


def final_option(opt: str) -> str:
    s = str(opt).strip()
    if "$" in s:
        return katexify_prose(s)
    if not re.search(r"[A-Za-z]{2,}", re.sub(r"\\[a-zA-Z]+", "", s)):
        return "$" + ascii_to_katex(s) + "$"
    return katexify_prose(s)


def final_diag(c: dict) -> dict:
    return {"node_id": c["node_id"], "question_text": katexify_prose(c["question_text"]),
            "options": [final_option(o) for o in c["options"]],
            "correct_option_index": c["correct_option_index"], "difficulty": "challenge"}


def final_quiz(c: dict) -> dict:
    """The practice_problems row fields exactly as they will be stored (KaTeX conventions)."""
    steps, extras = [], {}
    for s in c["all_steps"]:
        steps.append({
            "step_index": s["step_index"], "step_type": s["step_type"],
            "instruction": katexify_prose(s["instruction"]),
            "blank_expression": to_blank(s["blank_expression"]),
            "correct_value": to_value(s["correct_value"]),
            "operation_description": katexify_prose(s["operation_description"]),
            "mapped_node_id": s["mapped_node_id"],
        })
        e = c["extras"][str(s["step_index"])]
        extras[str(s["step_index"])] = {
            "distractors": [to_value(d) for d in e["distractors"]], "hint": katexify_prose(e["hint"]),
        }
    return {"word_problem_text": katexify_prose(c["word_problem"]), "steps": steps, "extras": extras,
            "answer": to_value(c["answer"])}


def check_final(v, c: dict, bank: str) -> list:
    """Problems with the stored form of an approved item (empty list = fine to export)."""
    issues = []
    try:
        if bank == "diag":
            f = final_diag(c)
            texts = [f["question_text"]] + f["options"]
            for orig, fin in zip(c["options"], f["options"]):
                if "$" not in str(orig) and c["check"].get("kind") != "manual" and not roundtrip_ok(v, orig, fin):
                    issues.append(f"option {orig!r} changed meaning as {fin!r}")
        else:
            f = final_quiz(c)
            texts = [f["word_problem_text"]] + [s["instruction"] for s in f["steps"]] + \
                [e["hint"] for e in f["extras"].values()]
            for s, o in zip(f["steps"], c["all_steps"]):
                if s["blank_expression"].count("?") != 1 or "$" in s["correct_value"]:
                    issues.append(f"step {s['step_index']} blank/value format")
                if not roundtrip_ok(v, o["correct_value"], s["correct_value"]):
                    issues.append(f"step {s['step_index']} value {o['correct_value']!r} -> {s['correct_value']!r}")
        for t in texts:
            if not outside_math_is_clean(t):
                issues.append(f"raw math outside $...$: {t[:70]!r}")
    except Exception as exc:
        issues.append(f"conversion failed: {exc!r}")
    return issues


# --- review and export -------------------------------------------------------------------

def rejected_ids() -> dict:
    return (load_json(DECISIONS, {}) or {}).get("reject", {})


def approved(bank: str, node_id: str) -> list:
    data = load_json(os.path.join(VALID_DIR, f"{bank}_{node_id}.json"))
    rej = rejected_ids()
    return [c for c in (data or {}).get("kept", []) if c["cand_id"] not in rej]


def write_review(nodes: list):
    lines = ["# Challenge bank review", "",
             "Reject an item by adding its id to `knowledge_base/challenge/review_decisions.json`:",
             '`{"reject": {"diag-L1V-03": "reason"}}`', ""]
    for node_id in nodes:
        lines += [f"## {node_id} - {SPECS[node_id]['label']} (Grade {SPECS[node_id]['grade']})", ""]
        for c in approved("diag", node_id):
            letters = "ABCD"
            f = final_diag(c)
            lines += [f"### {c['cand_id']}  ({c['kind']} / {c['pattern']} / {c['context']})", "", f["question_text"], ""]
            lines += [f"- {'**' if i == c['correct_option_index'] else ''}{letters[i]}. {o}"
                      f"{'**' if i == c['correct_option_index'] else ''}" for i, o in enumerate(f["options"])]
            lines += ["", f"SLM concept: {c['slm_concept']}  |  verified by: {c.get('verified_by')}", ""]
        for c in approved("quiz", node_id):
            f = final_quiz(c)
            lines += [f"### {c['cand_id']}  ({c['kind']} / {c['pattern']} / {c['context']})", "",
                      f["word_problem_text"], "", f"Expression: `{c['problem_expr']}`  |  Answer: **`{f['answer']}`**", ""]
            for s in f["steps"]:
                e = f["extras"][str(s["step_index"])]
                lines.append(f"{s['step_index']}. [{s['step_type']}] {s['instruction']} `{s['blank_expression']}` "
                             f"= **`{s['correct_value']}`**  | distractors: {e['distractors']}  | hint: {e['hint']}")
            lines += ["", f"SLM concept: {c['slm_concept']}  |  verified by: {c.get('verified_by')}", ""]
    os.makedirs(WORK, exist_ok=True)
    with open(REVIEW_MD, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {REVIEW_MD}")


def sql_str(s) -> str:
    return "'" + str(s).replace("'", "''") + "'"


def quiz_row(c: dict) -> dict:
    f = final_quiz(c)
    steps, extras = f["steps"], f["extras"]
    return {
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"suri-challenge:{c['node_id']}:{c['problem_expr']}")),
        "node_id": c["node_id"], "problem_expr": c["problem_expr"], "steps_json": steps,
        "word_problem_text": f["word_problem_text"], "step_extras_json": extras, "difficulty": "challenge",
    }


def export(nodes: list):
    # diagnostic: append after the existing items, which must stay byte-identical
    with open(PROBES_PATH, encoding="utf-8") as f:
        before_text = f.read()
    probes = json.loads(before_text)
    v = Verifier()
    try:
        problems = [(n, c, b) for n in nodes for b in ("diag", "quiz") for c in approved(b, n)]
        bad = [(c["cand_id"], i) for n, c, b in problems for i in check_final(v, c, b)]
    finally:
        v.close()
    if bad:
        sys.exit("ERROR: stored KaTeX form has problems; fix the generator or reject these items:\n" +
                 "\n".join(f"  {cid}: {i}" for cid, i in bad))
    before = {k: [json.dumps(p, sort_keys=True) for p in v] for k, v in probes.items()}
    for node_id in nodes:
        have = {p["question_text"] for p in probes[node_id]}
        for c in approved("diag", node_id):
            if final_diag(c)["question_text"] in have:
                continue
            probes[node_id].append(final_diag(c))
    for node_id, old in before.items():
        assert [json.dumps(p, sort_keys=True) for p in probes[node_id][:len(old)]] == old, f"{node_id} existing probes changed"
    assert "PD" not in nodes
    with open(PROBES_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(probes, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # quiz: JSON + idempotent seed SQL
    rows = [quiz_row(c) for node_id in nodes for c in approved("quiz", node_id)]
    all_rows = {r["id"]: r for r in (load_json(PRACTICE_JSON, []) or [])}
    all_rows.update({r["id"]: r for r in rows})
    save_json(PRACTICE_JSON, list(all_rows.values()))
    now = datetime.now(timezone.utc).isoformat()
    sql = ["-- Challenge practice problems (CU-14ypx624mw5). Idempotent: ids are uuid5(node + problem_expr).",
           "ALTER TABLE practice_problems ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'standard';", ""]
    for r in all_rows.values():
        sql.append(
            "INSERT INTO practice_problems (id, node_id, problem_expr, steps_json, word_problem_text, "
            "step_extras_json, difficulty, created_at) VALUES ("
            f"{sql_str(r['id'])}, {sql_str(r['node_id'])}, {sql_str(r['problem_expr'])}, "
            f"{sql_str(json.dumps(r['steps_json'], ensure_ascii=False))}, {sql_str(r['word_problem_text'])}, "
            f"{sql_str(json.dumps(r['step_extras_json'], ensure_ascii=False))}, 'challenge', {sql_str(now)}) "
            "ON CONFLICT DO NOTHING;")
    with open(SEED_SQL, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(sql) + "\n")
    print(f"exported {sum(len(approved('diag', n)) for n in nodes)} diagnostic items, {len(all_rows)} quiz rows")


# --- driver ------------------------------------------------------------------------------

def parse_nodes(arg) -> list:
    nodes = [n.strip() for n in arg.split(",")] if arg else list(IN_SCOPE)
    bad = [n for n in nodes if n not in IN_SCOPE]
    if bad:
        sys.exit(f"ERROR: {bad} are outside the learning-path scope {IN_SCOPE}")
    return nodes


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["diagnostic", "quiz", "validate", "review", "export"])
    ap.add_argument("--nodes", help="comma-separated node ids (default: all in-scope nodes)")
    ap.add_argument("--topup", action="store_true", help="generate extra candidates for nodes that validated short")
    ap.add_argument("--dry-run", action="store_true", help="print the first prompt and exit (no API call)")
    args = ap.parse_args()
    nodes = parse_nodes(args.nodes)

    if args.dry_run:
        node = nodes[0]
        excerpt = grounding_text(pdfs_for(node), cap=SLM_CAP)
        if args.command == "quiz":
            print(quiz_prompt(node, kinds_for(node, False)[0], excerpt))
        else:
            print(diag_prompt(node, DIAG_CANDIDATES, existing_questions(node), kinds_for(node, True), excerpt))
        return
    if args.command == "review":
        return write_review(nodes)
    if args.command == "export":
        return export(nodes)

    gem = Gemini()
    try:
        for node_id in nodes:
            print(f"{args.command} {node_id}  (calls today: {calls_today()})", flush=True)
            if args.command == "diagnostic":
                gen_diagnostic(gem, node_id, args.topup)
            elif args.command == "quiz":
                gen_quiz(gem, node_id, args.topup)
            else:
                validate_node(gem, "diag", node_id)
                validate_node(gem, "quiz", node_id)
    except StopRun as stop:
        print(f"\nSTOPPED: {stop}. Re-run the same command to resume; finished work is cached in {WORK}.")
        sys.exit(1)  # non-zero so a chained command does not carry on with missing candidates


if __name__ == "__main__":
    main()
