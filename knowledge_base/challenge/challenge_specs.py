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
from topic_specs import GLOBAL_RULES, pdfs_for  # noqa: E402,F401


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
