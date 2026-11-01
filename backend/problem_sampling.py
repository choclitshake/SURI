"""Difficulty-aware sampling shared by the quiz and standard practice modes."""

import random


def sample_mixed(rows, total: int = 5, challenge: int = 2, rng=random) -> list:
    """Pick `total` rows: up to `challenge` challenge rows, the rest standard.

    Falls back to the other pool when one runs short. Rows are mappings with a
    "difficulty" key; a missing key counts as standard. The result is shuffled.
    """
    rows = list(rows)
    hard = [r for r in rows if r.get("difficulty", "standard") == "challenge"]
    easy = [r for r in rows if r.get("difficulty", "standard") != "challenge"]

    picked_hard = rng.sample(hard, min(challenge, len(hard), total))
    picked_easy = rng.sample(easy, min(total - len(picked_hard), len(easy)))
    picked = picked_hard + picked_easy

    short = total - len(picked)
    if short > 0:
        left = [r for r in hard if r not in picked_hard]
        picked += rng.sample(left, min(short, len(left)))

    rng.shuffle(picked)
    return picked
