"""
Challenge-problem specs per learning-path node.

Each kind is (description, pattern, mcq_only). `mcq_only` kinds ("spot the error", "which must be
true") cannot be typed as one short answer, so they are used for diagnostic items only.
Scope is computed from the graph: nodes reachable from ENTRY_NODES via `prerequisite`.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(HERE, "..", "playground"))

from backend.graph import GRAPH, ENTRY_NODES  # noqa: E402
from topic_specs import GLOBAL_RULES  # noqa: E402

# The PDF file names in slm_pdfs do not match their contents (e.g. grade7_linear_equations_one_var.pdf is the
# Special Products module), so topic_specs.pdfs_for would ground a node on the wrong lesson. This map is by the
# module title printed inside each PDF. Gaps: there is no systems-of-equations module (SLE falls back to the
# linear-equation modules), no quadratic-formula/discriminant module (QE has factoring and square roots only),
# and no Grade 10 polynomial-equations module (PE uses the factor-theorem and polynomial-division modules).
SLM_PDFS = {
    "FD": ["grade6_fractions_addition_subtraction.pdf", "grade6_fractions_division.pdf",
           "grade6_fractions_multiplication.pdf"],
    "RPP": ["grade6_decimals_operations.pdf", "grade6_ratio_proportion.pdf", "grade6_percent.pdf",
            "grade6_rate_speed_distance.pdf"],
    "OI": ["grade7_operations_integers.pdf", "grade7_absolute_value_integers.pdf"],
    "LE": ["grade9_simplifying_radicals.pdf"],
    "AE": ["grade7_algebraic_expressions.pdf", "grade7_solving_equations.pdf"],
    "L1V": ["grade7_polynomial_multiplication.pdf", "grade7_special_products.pdf", "grade7_solving_equations.pdf"],
    "SP": ["grade7_linear_equations_one_var.pdf"],
    "PO": ["grade7_evaluating_expressions.pdf"],
    "FP": ["grade8_factoring_gcf.pdf", "grade8_factoring_difference_squares.pdf"],
    "L2V": ["grade8_slope_intercept.pdf", "grade8_linear_equations_two_var.pdf",
            "grade8_systems_equations_algebraic.pdf", "grade8_systems_equations_graphing.pdf"],
    "SLE": ["grade8_systems_equations_algebraic.pdf", "grade8_slope_intercept.pdf"],
    "QE": ["grade9_quadratic_equations_intro.pdf", "grade9_quadratic_formula.pdf", "grade9_discriminant_roots.pdf"],
    "RER": ["grade9_operations_radicals.pdf", "grade9_radical_equations.pdf", "grade9_rational_exponents.pdf",
            "grade9_rational_exponents_advanced.pdf"],
    "PE": ["grade10_polynomial_graphs.pdf", "grade10_polynomial_roots.pdf"],
}


def pdfs_for(node_id: str) -> list:
    return SLM_PDFS[node_id]


def _in_scope() -> list:
    seen = []
    for entry in ENTRY_NODES:
        node = entry
        while node and node not in seen:
            seen.append(node)
            node = GRAPH[node]["prerequisite"]
    return seen


IN_SCOPE = _in_scope()
assert "PD" not in IN_SCOPE, "PD is not on any learning path and must stay out of scope"

# Reasoning patterns
BACK = "work backwards"
BOTH = "two conditions at once"
COMPARE = "compare or decide"
MULTI = "multi-stage change"
REVERSE = "reverse the skill"
ERROR = "spot the error"
PATTERN = "pattern to rule"

CHALLENGE_NOTES = (
    "A challenge item needs 2-3 linked reasoning moves. Keep the numbers friendly: the difficulty "
    "comes from the logic, not the arithmetic. Use only methods that appear in the SLM excerpt."
)

# Age problems are allowed only in these nodes (max 1 per bank per node).
AGE_NODES = {"L1V", "SLE", "QE"}

SPECS = {
    "FD": {"kinds": [
        ("work backwards: after giving away 2/5 and then 1/3 of the rest, 12 are left; how many at first", BACK, False),
        ("a ribbon cut into pieces, then the leftover compared with the original length", MULTI, False),
        ("which of two offers gives more (one in fractions, one in decimals)", COMPARE, False),
        ("a recipe scaled up, then split among people", MULTI, False),
        ("spot the error in a worked fraction division", ERROR, True),
    ], "contexts": ["recipe", "ribbon", "canteen", "school fair", "market"],
        "notes": "Answers are fractions in lowest terms, decimals or whole numbers."},
    "RPP": {"kinds": [
        ("a ratio that changes after some items are added", MULTI, False),
        ("divide an amount into 3 parts by ratio, with one part given", BOTH, False),
        ("a discount followed by a markup: is the price back to the original", MULTI, False),
        ("a two-leg trip with an average speed", BOTH, False),
        ("best buy by unit price", COMPARE, False),
        ("percent of a percent", MULTI, False),
    ], "contexts": ["store", "jeepney", "market", "school fair", "canteen"],
        "notes": "Percent answers are plain numbers with unit %. Never answer a ratio as a:b."},
    "OI": {"kinds": [
        ("a missing starting value from a sequence of gains and losses", BACK, False),
        ("temperature or elevation change over several stages", MULTI, False),
        ("a game score with penalties: find how many answers were wrong", BOTH, False),
        ("which expression gives a given value (order of operations)", COMPARE, True),
        ("a sum of integers that follows a pattern", PATTERN, False),
    ], "contexts": ["game", "temperature", "elevation", "bank balance", "basketball league"],
        "notes": "Answers are integers."},
    "LE": {"kinds": [
        ("find the missing exponent so both sides are equal", REVERSE, False),
        ("compare the sizes of two expressions with powers", COMPARE, True),
        ("cell doubling over stages, written as a power", PATTERN, False),
        ("spot the error in a simplification", ERROR, True),
        ("area or volume given by power expressions", MULTI, False),
    ], "contexts": ["bacteria", "garden", "storage box", "science lab", "school fair"],
        "notes": "Use positive integer exponents unless the excerpt shows zero or negative exponents."},
    "AE": {"kinds": [
        ("write the expression from a several-part description, then evaluate", MULTI, False),
        ("which of two pricing expressions costs less for a given input", COMPARE, False),
        ("a pattern of figures (matchsticks, tiles) to an expression for the nth figure", PATTERN, False),
        ("which expression must equal the given one (equivalent expressions)", ERROR, True),
    ], "contexts": ["tiles", "matchsticks", "canteen", "phone load", "sports club"],
        "notes": "Quiz answers are a number or an expanded expression."},
    "L1V": {"kinds": [
        ("consecutive odd or even integers with a condition", BOTH, False),
        ("coins or bills of two types with a total", BOTH, False),
        ("perimeter with sides given in relation to each other", BOTH, False),
        ("work backwards from a think-of-a-number puzzle", BACK, False),
        ("a phone plan with a fee plus a rate: find the usage", BACK, False),
        ("an age problem (at most one)", BOTH, False),
    ], "contexts": ["sari-sari store", "phone load", "garden", "canteen", "school fair"],
        "notes": "One variable, a linear equation. At most 1 age problem."},
    "SP": {"kinds": [
        ("the area of a border or frame (outer area minus inner area)", MULTI, False),
        ("a square garden enlarged by n on each side: find the extra area", MULTI, False),
        ("use a special product to compute mentally (e.g. 49 x 51)", REVERSE, False),
        ("which expansion is correct (spot the error)", ERROR, True),
        ("the area of a figure with binomial sides", MULTI, False),
    ], "contexts": ["garden", "picture frame", "tiles", "floor", "school fair"],
        "notes": "Answers are expanded polynomials or numbers."},
    "PO": {"kinds": [
        ("the perimeter of a composite figure with polynomial sides", MULTI, False),
        ("total cost and revenue polynomials combined", BOTH, False),
        ("find the missing polynomial that makes a given sum", REVERSE, False),
        ("the area left over after cutting a rectangle out of a larger one", MULTI, False),
        ("spot the error in subtracting polynomials", ERROR, True),
    ], "contexts": ["garden", "floor", "bakery", "sports club", "school fair"],
        "notes": "Answers are simplified polynomials."},
    "FP": {"kinds": [
        ("from a rectangle's area polynomial, find possible side lengths", REVERSE, False),
        ("factor completely in 2 stages (GCF, then a special pattern)", MULTI, False),
        ("use factoring to compute mentally (e.g. 53^2 - 47^2)", REVERSE, False),
        ("which trinomial is NOT factorable over the integers", ERROR, True),
        ("a missing coefficient that makes a trinomial factorable", REVERSE, False),
    ], "contexts": ["garden", "floor", "tiles", "poster", "school fair"],
        "notes": "Factored answers must be complete and primitive."},
    "L2V": {"kinds": [
        ("two plans (fixed fee plus rate): when do they cost the same", COMPARE, False),
        ("interpret slope and intercept in a context", REVERSE, False),
        ("find the missing coordinate so a point is on a line", BOTH, False),
        ("the line through two data points, then predict", MULTI, False),
        ("which equation matches a table", PATTERN, True),
    ], "contexts": ["taxi fare", "phone load", "savings", "water refill", "internet cafe"],
        "notes": "Equation answers use y = mx + b."},
    "SLE": {"kinds": [
        ("two ticket prices with total tickets and total revenue", BOTH, False),
        ("two-digit number puzzles (digit sum and reversal)", BOTH, False),
        ("mixture or coin mix with friendly numbers", BOTH, False),
        ("boat or wind with and against the current (only if the excerpt shows rate problems)", BOTH, False),
        ("two notebook and pen purchases", BOTH, False),
        ("an age problem (at most one)", BOTH, False),
    ], "contexts": ["school fair", "canteen", "bookstore", "coin bank", "jeepney"],
        "notes": "Integer solutions; the prompt must say which value is x and which is y."},
    "QE": {"kinds": [
        ("product of consecutive integers", BOTH, False),
        ("a garden with a uniform walkway of unknown width", MULTI, False),
        ("a rectangle from its perimeter and area", BOTH, False),
        ("projectile height: the time when h = 0, with a given formula and friendly roots", MULTI, False),
        ("choose the valid root in context (discard the negative)", COMPARE, False),
        ("the nature of roots from the discriminant to decide a condition", REVERSE, False),
    ], "contexts": ["garden", "picture frame", "ball throw", "floor", "school fair"],
        "notes": "Ask for ALL solutions unless the context rules one out."},
    "RER": {"kinds": [
        ("simplify, then compare two radical expressions", COMPARE, True),
        ("convert between rational-exponent and radical form inside a context (square side from area, cube edge from volume)", REVERSE, False),
        ("find the missing exponent", REVERSE, False),
        ("spot the error in combining radicals", ERROR, True),
        ("a simple radical equation with a context check", BACK, False),
    ], "contexts": ["square plot", "cube box", "tiles", "garden", "science lab"],
        "notes": "Use simplest radical form."},
    "PE": {"kinds": [
        ("an open box from a sheet with corners cut out, giving a cubic", MULTI, False),
        ("a number puzzle leading to a factorable cubic", BACK, False),
        ("find all real roots given one root", REVERSE, False),
        ("the number of positive roots from the context", COMPARE, True),
        ("a box volume with dimensions in relation to each other", BOTH, False),
    ], "contexts": ["box", "storage tank", "cardboard", "school fair", "garden"],
        "notes": "All roots are integers; ask for ALL solutions."},
}

# Extra typeable kinds, so every node has enough distinct kinds for a quiz set (5 problems, no kind twice).
EXTRA_KINDS = {
    "FD": [("a fraction of an amount is spent, then a decimal share of the rest: find what is left", MULTI),
           ("find the missing fraction that completes a total", REVERSE)],
    "OI": [("find the integer that makes two integer expressions equal", REVERSE),
           ("an average of integer temperatures over several days with one day missing", REVERSE),
           ("a walk along a number line with forward and backward moves: find the missing move", BACK)],
    "LE": [("a product of powers with different bases rewritten with one common base", MULTI),
           ("a quantity multiplied by the same factor several times, found as a power", PATTERN),
           ("find the base when the power and the result are given", REVERSE)],
    "AE": [("evaluate a formula given in words for two cases, then find the difference", MULTI),
           ("find the value of the variable that makes an expression equal a given amount", REVERSE),
           ("combine like terms from a perimeter description, then evaluate", MULTI)],
    "SP": [("find the missing term that makes a binomial square", REVERSE),
           ("find the value of k so a special product has no middle term", REVERSE)],
    "PO": [("subtract one polynomial from another, then evaluate at a value", MULTI),
           ("a profit polynomial from revenue and cost, then evaluate", BOTH)],
    "FP": [("find the missing term that makes a binomial a difference of squares", REVERSE),
           ("factor out a negative common factor, then finish factoring", MULTI)],
    "L2V": [("find the x-intercept in a context", MULTI),
            ("the rate of change and the starting value from two table entries", BOTH)],
    "PE": [("find a coefficient given that a number is a root", REVERSE),
           ("solve a polynomial equation after factoring by grouping in a context", MULTI)],
    "RER": [("evaluate a rational exponent after simplifying the radicand", MULTI),
            ("the volume of a cube whose edge is a simplified radical", MULTI),
            ("a cube root of a product that must be simplified inside a context", MULTI)],
}
for _node, _extra in EXTRA_KINDS.items():
    SPECS[_node]["kinds"].extend((text, pattern, False) for text, pattern in _extra)

for _node, _spec in SPECS.items():
    _spec["grade"] = GRAPH[_node]["grade"]
    _spec["label"] = GRAPH[_node]["label"]
    for _kind in _spec["kinds"]:
        if "age problem" in _kind[0] and _node not in AGE_NODES:
            raise AssertionError(f"age problem not allowed in {_node}")

assert set(SPECS) == set(IN_SCOPE), (set(SPECS) ^ set(IN_SCOPE))
assert "PD" not in SPECS


def kinds_for(node_id: str, mcq: bool) -> list:
    """Kinds usable for a bank: all for diagnostic (mcq), typeable ones for the quiz."""
    return [k for k in SPECS[node_id]["kinds"] if mcq or not k[2]]


for _node in IN_SCOPE:
    assert len(kinds_for(_node, False)) >= 6, f"{_node} needs at least 6 typeable kinds"
assert set(SLM_PDFS) == set(IN_SCOPE)
