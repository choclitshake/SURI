import json
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
KB = os.path.join(ROOT, "knowledge_base")
if KB not in sys.path:
    sys.path.insert(0, KB)

import fix_stored_katex as fx  # noqa: E402


class BlankTests(unittest.TestCase):
    def test_bare_math_blank_becomes_question_mark(self):
        self.assertEqual(fx.fix_blank("2y = ___"), "2y = ?")
        self.assertEqual(fx.fix_blank("(x + 3y) - (x + y) = 10 - ___"), "(x + 3y) - (x + y) = 10 - ?")

    def test_word_like_blank_is_left_alone(self):
        self.assertEqual(fx.fix_blank("Total energy per node = ___"), "Total energy per node = ___")
        self.assertEqual(fx.fix_blank("x = 2, y = ___"), "x = 2, y = ___")

    def test_blank_outside_a_span_is_left_alone(self):
        self.assertEqual(fx.fix_blank("$x = 3$ ___"), "$x = 3$ ___")

    def test_blank_inside_a_span_moves_outside(self):
        self.assertEqual(fx.fix_blank("$2x = ___$"), "$2x = $ ?")
        self.assertEqual(fx.fix_blank("$___ + 3 = 5$"), "? $ + 3 = 5$")

    def test_blank_inside_a_group_is_not_touched(self):
        self.assertEqual(fx.fix_blank(r"$x = \frac{15}{___}$"), r"$x = \frac{15}{___}$")

    def test_already_converted_blank_is_left_alone(self):
        self.assertEqual(fx.fix_blank("$2w =$ ?"), "$2w =$ ?")


class TextTests(unittest.TestCase):
    def test_underscores_inside_math_are_escaped_prose_is_kept(self):
        self.assertEqual(fx.fix_text("so $b=___$ here ___"), "so $b=\\_\\_\\_$ here ___")

    def test_backticks_around_math_are_removed(self):
        self.assertEqual(fx.fix_text("multiply `$2$` by x"), "multiply $2$ by x")

    def test_form_feed_becomes_frac(self):
        self.assertEqual(fx.fix_text("\x0crac{(x - 3)}{x - 3}"), "\\frac{(x - 3)}{x - 3}")
        self.assertEqual(fx.fix_text("$\\\x0crac{2x}{x}$"), "$\\frac{2x}{x}$")

    def test_other_control_chars_only_when_a_command_follows(self):
        self.assertEqual(fx.fix_text("\x09imes"), "\\times")
        self.assertEqual(fx.fix_text("a\x09b"), "a\x09b")

    def test_double_backslash_command_is_collapsed(self):
        self.assertEqual(fx.fix_text("ratio is $\\\\frac{1}{2}$"), "ratio is $\\frac{1}{2}$")

    def test_clean_text_is_unchanged_and_idempotent(self):
        for s in ("Find $x$ when $2x = 6$.", "$\\frac{3}{4}$", "x = 4", ""):
            self.assertEqual(fx.fix_text(s), s)
        messy = "see `$a$` and $b=___$ and \x0crac{1}{2}"
        self.assertEqual(fx.fix_text(fx.fix_text(messy)), fx.fix_text(messy))


class RowTests(unittest.TestCase):
    def test_row_fixes_blank_extras_and_leaves_correct_values_stable(self):
        steps = [{"step_index": 0, "step_type": "algebra", "instruction": "Set $y = ___$", "blank_expression": "y = ___",
                  "correct_value": "6", "operation_description": "d", "mapped_node_id": "L1V"}]
        extras = {"0": {"distractors": ["\x0crac{1}{2}", "3", "4"], "hint": "use `$y$`"}}
        row = {"id": "r1", "node_id": "L1V", "problem_expr": "y = 6", "steps_json": json.dumps(steps),
               "word_problem_text": "plain", "step_extras_json": json.dumps(extras)}
        changed = fx.fix_practice_row(row)
        new_steps = json.loads(changed["steps_json"])
        self.assertEqual(new_steps[0]["blank_expression"], "y = ?")
        self.assertEqual(new_steps[0]["instruction"], "Set $y = \\_\\_\\_$")
        self.assertEqual(new_steps[0]["correct_value"], "6")
        new_extras = json.loads(changed["step_extras_json"])
        self.assertEqual(new_extras["0"]["distractors"][0], "\\frac{1}{2}")
        self.assertEqual(new_extras["0"]["hint"], "use $y$")
        self.assertNotIn("word_problem_text", changed)

    def test_clean_row_has_no_changes(self):
        steps = [{"step_index": 0, "instruction": "Add", "blank_expression": "$2x =$ ?", "correct_value": "6"}]
        row = {"id": "r2", "node_id": "L1V", "steps_json": json.dumps(steps, ensure_ascii=False),
               "word_problem_text": "Find $x$.", "step_extras_json": json.dumps({"0": {"distractors": ["1", "2", "3"], "hint": "h"}})}
        self.assertEqual(fx.fix_practice_row(row), {})


if __name__ == "__main__":
    unittest.main()
