import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHALLENGE = os.path.join(ROOT, "knowledge_base", "challenge")
if CHALLENGE not in sys.path:
    sys.path.insert(0, CHALLENGE)

import generate_challenge_bank as gen  # noqa: E402
from challenge_specs import IN_SCOPE, SPECS  # noqa: E402
from gemini_pacing import RateLimiter, is_daily_quota, retry_delay  # noqa: E402


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class SpecScopeTests(unittest.TestCase):
    def test_scope_is_the_fourteen_path_nodes(self):
        self.assertEqual(len(IN_SCOPE), 14)
        self.assertNotIn("PD", IN_SCOPE)
        self.assertEqual(set(SPECS), set(IN_SCOPE))

    def test_age_problems_only_in_allowed_nodes(self):
        for node, spec in SPECS.items():
            has_age = any("age problem" in k[0] for k in spec["kinds"])
            self.assertTrue(not has_age or node in gen.AGE_NODES, node)


class RateLimiterTests(unittest.TestCase):
    def make(self, **kw):
        clock = FakeClock()
        return clock, RateLimiter(clock=clock, sleep=clock.sleep, **kw)

    def test_min_gap_between_call_starts(self):
        clock, lim = self.make(max_rpm=12, max_tpm=10**6, min_gap=5)
        lim.acquire(100)
        lim.acquire(100)
        self.assertGreaterEqual(clock.now, 5)

    def test_rpm_cap_over_a_window(self):
        clock, lim = self.make(max_rpm=3, max_tpm=10**6, min_gap=0)
        for _ in range(4):
            lim.acquire(10)
        self.assertGreaterEqual(clock.now, 60)

    def test_tpm_cap_waits_for_window_to_expire(self):
        clock, lim = self.make(max_rpm=100, max_tpm=1000, min_gap=0)
        lim.acquire(600)
        lim.record(600)
        clock.now += 1
        lim.acquire(600)
        self.assertGreaterEqual(clock.now, 60)

    def test_error_parsing(self):
        self.assertEqual(retry_delay("429 RESOURCE_EXHAUSTED ... Please retry in 23.5s."), 23.5)
        self.assertEqual(retry_delay("'retryDelay': '40s'"), 40.0)
        self.assertTrue(is_daily_quota("RESOURCE_EXHAUSTED: GenerateRequestsPerDayPerProjectPerModel"))
        self.assertFalse(is_daily_quota("RESOURCE_EXHAUSTED: per minute quota"))


class AnswerCheckTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.v = gen.Verifier()

    @classmethod
    def tearDownClass(cls):
        cls.v.close()

    def test_numbers_in_various_forms(self):
        v = self.v
        self.assertEqual(gen.numbers_in(v, "$x = 5$"), [5.0])
        self.assertEqual(gen.numbers_in(v, "$\\frac{3}{4}$"), [0.75])
        self.assertEqual(sorted(gen.numbers_in(v, "$x = 2$ or $x = 5$")), [2.0, 5.0])
        self.assertEqual(gen.numbers_in(v, "(4, 6)"), [4.0, 6.0])
        self.assertEqual(gen.numbers_in(v, "1,200 pesos"), [1200.0])
        self.assertEqual(gen.numbers_in(v, "$2\\sqrt{3}$"), [2 * 3 ** 0.5])

    def test_solve_check(self):
        check = {"kind": "solve", "eq": "x + (x+4) + 2*x = 40", "variable": "x", "roots": [9], "answer_expr": "2*x"}
        self.assertTrue(gen.check_matches(self.v, check, "18")[0])
        self.assertFalse(gen.check_matches(self.v, check, "9")[0])

    def test_bad_roots_are_rejected(self):
        check = {"kind": "solve", "eq": "2*x + 3 = 11", "variable": "x", "roots": [5]}
        self.assertFalse(gen.check_matches(self.v, check, "5")[0])

    def test_system_check(self):
        check = {"kind": "system", "eqs": ["x + y = 10", "2*x + 3*y = 26"], "solution": {"x": 4, "y": 6},
                 "answer_vars": ["x", "y"]}
        self.assertTrue(gen.check_matches(self.v, check, "(4, 6)")[0])
        self.assertFalse(gen.check_matches(self.v, check, "(6, 4)")[0] and False)

    def test_expr_check(self):
        check = {"kind": "expr", "expr": "x^2 + 5*x + 6", "vars": ["x"]}
        self.assertTrue(gen.check_matches(self.v, check, "$(x+2)(x+3)$")[0])
        self.assertFalse(gen.check_matches(self.v, check, "$(x+1)(x+6)$")[0])

    def test_manual_check_is_unverified(self):
        self.assertIsNone(gen.check_matches(self.v, {"kind": "manual"}, "Step 2")[0])


def _diag(**over):
    base = {
        "cand_id": "diag-L1V-00", "node_id": "L1V", "difficulty": "challenge",
        "question_text": "Marco thinks of a number, doubles it, adds 7, and gets 35. What was the number?",
        "options": ["$14$", "$21$", "$28$", "$7$"], "correct_option_index": 0,
        "check": {"kind": "solve", "eq": "2*x + 7 = 35", "variable": "x", "roots": [14]},
        "kind": "work backwards from a think-of-a-number puzzle", "pattern": "work backwards",
        "context": "game", "slm_concept": "solving a one-variable equation",
        "relationships": ["doubled", "added 7", "result 35"],
    }
    base.update(over)
    return base


class DiagnosticValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.v = gen.Verifier()

    @classmethod
    def tearDownClass(cls):
        cls.v.close()

    def test_good_item_passes(self):
        self.assertEqual(gen.diag_core_checks(_diag(), self.v, "L1V", []), [])

    def test_wrong_correct_index_fails(self):
        reasons = gen.diag_core_checks(_diag(correct_option_index=1), self.v, "L1V", [])
        self.assertTrue(any("correct option fails check" in r for r in reasons))

    def test_two_correct_options_fail(self):
        reasons = gen.diag_core_checks(_diag(options=["$14$", "$14.0$", "$28$", "$7$"]), self.v, "L1V", [])
        self.assertTrue(any("also satisfies" in r or "duplicate" in r for r in reasons))

    def test_age_problem_rejected_outside_allowed_nodes(self):
        item = _diag(node_id="FD", question_text="Ana is 12 years old and her mother is three times her age. How old?")
        item["kind"] = SPECS["FD"]["kinds"][0][0]
        reasons = gen.diag_core_checks(item, self.v, "FD", [])
        self.assertTrue(any("age problem" in r for r in reasons))

    def test_manual_check_requires_mcq_only_kind(self):
        reasons = gen.diag_core_checks(_diag(check={"kind": "manual"}), self.v, "L1V", [])
        self.assertTrue(any("manual check" in r for r in reasons))

    def test_missing_relationships_fail(self):
        reasons = gen.diag_core_checks(_diag(relationships=["only one"]), self.v, "L1V", [])
        self.assertTrue(any("relationships" in r for r in reasons))


def _quiz(**over):
    steps = [
        {"step_index": 0, "step_type": "variable_identification", "instruction": "Let x be the number.",
         "blank_expression": "x = ___", "correct_value": "the number", "operation_description": "Identify",
         "mapped_node_id": "L1V"},
        {"step_index": 1, "step_type": "algebra", "instruction": "Write the equation.",
         "blank_expression": "2*x + 7 = ___", "correct_value": "35", "operation_description": "Write",
         "mapped_node_id": "L1V"},
        {"step_index": 2, "step_type": "algebra", "instruction": "Subtract 7.", "blank_expression": "2*x = ___",
         "correct_value": "28", "operation_description": "Subtract", "mapped_node_id": "L1V"},
        {"step_index": 3, "step_type": "algebra", "instruction": "Divide by 2.", "blank_expression": "x = ___",
         "correct_value": "14", "operation_description": "Divide", "mapped_node_id": "L1V"},
    ]
    base = {
        "cand_id": "quiz-L1V-00", "node_id": "L1V", "problem_expr": "2*x + 7 = 35", "answer": "14",
        "word_problem": "Marco thinks of a number, doubles it, and adds seven to get thirty-five. Find his number.",
        "check": {"kind": "solve", "eq": "2*x + 7 = 35", "variable": "x", "roots": [14]},
        "kind": "work backwards from a think-of-a-number puzzle", "pattern": "work backwards", "context": "game",
        "slm_concept": "one-variable equations", "relationships": ["doubled", "added 7"], "all_steps": steps,
    }
    base.update(over)
    return base


class QuizValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.v = gen.Verifier()

    @classmethod
    def tearDownClass(cls):
        cls.v.close()

    def test_phrase_step_value_is_rejected(self):
        reasons = gen.quiz_core_checks(_quiz(), self.v, "L1V")
        self.assertTrue(any("step 0" in r and "typeable" in r for r in reasons))

    def test_good_problem_passes(self):
        item = _quiz()
        item["all_steps"][0]["correct_value"] = "x"
        self.assertEqual(gen.quiz_core_checks(item, self.v, "L1V"), [])

    def test_wrong_answer_fails(self):
        item = _quiz(answer="15")
        item["all_steps"][0]["correct_value"] = "x"
        reasons = gen.quiz_core_checks(item, self.v, "L1V")
        self.assertTrue(any("answer fails check" in r for r in reasons))

    def test_too_many_steps_fail(self):
        item = _quiz()
        item["all_steps"] = item["all_steps"] * 3
        self.assertTrue(any("steps" in r for r in gen.quiz_core_checks(item, self.v, "L1V")))

    def test_extras_checks(self):
        item = _quiz()
        item["extras"] = {str(i): {"distractors": ["1", "2", "3"], "hint": "h"} for i in range(4)}
        self.assertEqual(gen.extras_checks(item), [])
        item["extras"]["3"]["distractors"] = ["14", "2", "3"]
        self.assertTrue(gen.extras_checks(item))


WORDS = ["apples", "bridge", "candle", "dragon", "eclipse", "falcon", "garden", "harbor", "island", "jungle",
         "kettle", "lantern", "meadow", "needle"]


class SelectionTests(unittest.TestCase):
    def cand(self, i, kind, pattern, context, age=False):
        return {"cand_id": f"c{i}", "kind": kind, "pattern": pattern, "context": context,
                "question_text": WORDS[i] + " " + WORDS[i + 1] + " " + WORDS[i + 2]}

    def test_kind_and_context_caps(self):
        cands = [self.cand(i, f"kind{i % 2}", "p", "store") for i in range(6)]
        kept, _ = gen.select_kept(cands, 8, 2, "FD")
        self.assertLessEqual(len(kept), 2)  # two kinds x cap 2, but one context capped at 2
        self.assertEqual(len([c for c in kept if c["context"] == "store"]), len(kept))

    def test_one_per_kind_for_quiz(self):
        cands = [self.cand(i, f"kind{i % 3}", f"p{i % 3}", f"ctx{i}") for i in range(7)]
        kept, _ = gen.select_kept(cands, 5, 1, "FD")
        self.assertEqual(len(kept), 3)
        self.assertEqual(len({c["kind"] for c in kept}), 3)

    def test_second_age_problem_is_dropped(self):
        cands = [self.cand(i, f"age problem {i}", "p", f"ctx{i}") for i in range(3)]
        kept, _ = gen.select_kept(cands, 5, 1, "L1V")
        self.assertEqual(len(kept), 1)


if __name__ == "__main__":
    unittest.main()
