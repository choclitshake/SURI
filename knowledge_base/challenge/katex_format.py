"""
Convert generated text into the KaTeX conventions the SURI frontend renders (quiz/page.tsx, practice/page.tsx).

Stored-data conventions (checked against the pages and backend/routes/*_routes.normalize_val):
  - word_problem_text, instruction, hint, diagnostic question/options: prose with math inside $...$.
  - blank_expression: ONE $...$ math span with a single "?" for the blank (both pages replace the first "?"),
    words inside \\text{...}.
  - correct_value and distractors: bare LaTeX, NO $ and implicit multiplication ("2x+7", "\\frac{3}{4}"),
    because the quiz wraps bare values itself and standard practice compares them through normalize_val.
  - problem_expr stays mathjs-style ("2*x + 7 = 35"), like the existing rows.
"""

import re

_FUNCS = ("sqrt", "nthRoot")
_ATOM = (r"(?:\([^()]*\)|\\sqrt(?:\[\d+\])?\{[^{}]*\}|\d+\.?\d*[a-z]?(?:\^\{[^{}]*\})?"
         r"|\.\d+|[a-z](?:\^\{[^{}]*\})?|\x00\d+\x00)")
_FRAC = re.compile(rf"(?P<a>{_ATOM})\s*/\s*(?P<b>{_ATOM})")


def _match(s: str, i: int) -> int:
    depth = 0
    for j in range(i, len(s)):
        depth += s[j] == "("
        depth -= s[j] == ")"
        if depth == 0:
            return j
    raise ValueError("unbalanced parentheses")


def _split_top(s: str) -> list:
    parts, depth, cur = [], 0, ""
    for ch in s:
        depth += ch == "("
        depth -= ch == ")"
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    return parts + [cur]


def _strip_parens(x: str) -> str:
    return x[1:-1] if x.startswith("(") and x.endswith(")") else x


def _conv(s: str) -> str:
    out, i = [], 0
    while i < len(s):
        if s.startswith("sqrt(", i):
            j = _match(s, i + 4)
            out.append("\\sqrt{" + _conv(s[i + 5:j]) + "}")
            i = j + 1
        elif s.startswith("nthRoot(", i):
            j = _match(s, i + 7)
            a, n = _split_top(s[i + 8:j])[:2]
            out.append("\\sqrt[" + n.strip() + "]{" + _conv(a) + "}")
            i = j + 1
        elif s[i] == "^":
            if i + 1 < len(s) and s[i + 1] == "(":
                j = _match(s, i + 1)
                out.append("^{" + _conv(s[i + 2:j]) + "}")
                i = j + 1
            elif i + 1 < len(s) and s[i + 1] == "{":
                j = s.index("}", i + 1)  # already LaTeX: keep the braces
                out.append("^{" + _conv(s[i + 2:j]) + "}")
                i = j + 1
            else:
                m = re.match(r"[-+]?\d+(?:\.\d+)?|[a-z]", s[i + 1:])
                if not m:
                    out.append("^")  # unknown exponent form: leave it; check_final flags raw math
                    i += 1
                    continue
                out.append("^{" + m.group(0) + "}")
                i += 1 + len(m.group(0))
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


def ascii_to_katex(text: str) -> str:
    """mathjs-style text -> LaTeX (no surrounding $). Words become \\text{...}."""
    s = str(text).strip().replace("$", "")
    texts = []

    def hold(m):
        word = m.group(0)
        if word in _FUNCS:
            return word
        texts.append("\\text{" + word + "}")
        return f"\x00{len(texts) - 1}\x00"

    s = re.sub(r"(?<![\\A-Za-z])[A-Za-z][A-Za-z']+(?:\s+[A-Za-z][A-Za-z']+)*", hold, s)
    s = _conv(s)
    for _ in range(3):
        def frac(m):
            a, b = _strip_parens(m.group("a")), _strip_parens(m.group("b"))
            return "\\frac{" + a + "}{" + b + "}" if a and b else m.group(0)
        new = _FRAC.sub(frac, s)
        if new == s:
            break
        s = new
    s = re.sub(r"(?<=\d)\s*\*\s*(?=\d)", r" \\cdot ", s)
    s = re.sub(r"(?<=[\dA-Za-z)}])\s*\*\s*(?=[A-Za-z(\\])", "", s)
    s = s.replace("*", " \\cdot ")
    s = s.replace("<=", "\\le ").replace(">=", "\\ge ")
    s = re.sub(r"\x00(\d+)\x00", lambda m: texts[int(m.group(1))], s)
    return re.sub(r"\s+", " ", s).strip()


def to_value(text: str) -> str:
    """correct_value / distractor: bare LaTeX, implicit multiplication, no $."""
    return ascii_to_katex(text)


def to_blank(text: str) -> str:
    """blank_expression: one math span with a single ? for the blank."""
    s = str(text).replace("___", "?")
    if s.count("?") != 1:
        raise ValueError(f"blank_expression needs exactly one blank: {text!r}")
    return "$" + ascii_to_katex(s) + "$"


_MATH_TOKEN = re.compile(r"^[()\d.a-z^*/+\-=]+$")
_OPS = set("=+*^/")
_GLUE = {"+", "-", "=", "*", "/", "−"}


def _is_math_token(tok: str) -> bool:
    core = tok.rstrip(".,;:?!")
    if not core or not _MATH_TOKEN.match(core) or re.search(r"[a-z]{2,}", core):
        return False
    letters = re.findall(r"[a-z]", core)
    if letters == ["a"] and len(core) == 1:
        return False  # the English article
    return bool(letters) or any(c in _OPS for c in core)


def katexify_prose(text: str) -> str:
    """Wrap bare math in prose with $...$ and convert $...$ spans that still hold mathjs syntax."""
    out = []
    for piece in re.split(r"(\$[^$]+\$)", str(text)):
        if piece.startswith("$") and piece.endswith("$") and len(piece) > 1:
            out.append("$" + ascii_to_katex(piece[1:-1]) + "$")
            continue
        parts = re.split(r"(\s+)", piece)
        idx = [k for k, w in enumerate(parts) if w.strip()]
        math = {k: _is_math_token(parts[k]) for k in idx}
        glue = {k: parts[k].strip().rstrip(".,;:?!") in _GLUE or re.fullmatch(r"\d+\.?\d*", parts[k].strip().rstrip(".,;:?!"))
                for k in idx}
        for _ in range(3):  # operators and plain numbers join a run when next to a math token
            for n, k in enumerate(idx):
                if math[k] or not glue[k]:
                    continue
                near = [idx[m] for m in (n - 1, n + 1) if 0 <= m < len(idx)]
                if any(math[q] for q in near):
                    math[k] = True
        # a run of operators/numbers alone is not math ("5 + 3 pesos" stays unless a variable or = joins it)
        buf, k, n = [], 0, 0
        while n < len(parts):
            if n in math and math[n]:
                m = n
                last = n
                while m < len(parts):
                    if parts[m].strip() == "":
                        m += 1
                        continue
                    if math.get(m):
                        last = m
                        m += 1
                    else:
                        break
                core = "".join(parts[n:last + 1])
                trail = ""
                tm = re.search(r"[.,;:?!]+$", core)
                if tm:
                    trail, core = tm.group(0), core[:tm.start()]
                buf.append("$" + ascii_to_katex(core) + "$" + trail)
                n = last + 1
            else:
                buf.append(parts[n])
                n += 1
        out.append("".join(buf))
    return "".join(out)


def outside_math_is_clean(text: str) -> bool:
    """No raw math syntax left outside $...$ and the dollars are balanced."""
    if str(text).count("$") % 2:
        return False
    outside = re.sub(r"\$[^$]*\$", "", str(text))
    return not re.search(r"[*^]|\\frac|\\sqrt|_", outside)
